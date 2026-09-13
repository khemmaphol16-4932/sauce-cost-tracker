-- Delivery queue is independent of stock. Booking is a separate atomic operation.
create table public.delivery_orders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id),
  business_id uuid not null references public.businesses(id),
  channel text not null check (channel in ('self','grab','lineman','other')),
  reference text not null default '' check (length(reference) <= 80),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  notes text not null default '' check (length(notes) <= 500),
  status text not null default 'new' check (status in ('new','cooking','ready','delivered','cancelled')),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  booked_at timestamptz
);
create index delivery_orders_queue on public.delivery_orders(business_id, status, due_at);
create unique index delivery_orders_reference on public.delivery_orders(business_id, channel, reference)
  where reference <> '' and channel <> 'self';
alter table public.delivery_orders enable row level security;
create policy delivery_orders_read on public.delivery_orders for select to authenticated
  using (user_id = auth.uid() and exists(select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));
create policy delivery_orders_insert on public.delivery_orders for insert to authenticated
  with check (user_id = auth.uid() and status = 'new' and booked_at is null and exists(select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));
create function public.validate_delivery_items() returns trigger language plpgsql set search_path=public as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item->'qty') is distinct from 'number' or jsonb_typeof(item->'price') is distinct from 'number'
      or (item->>'qty')::numeric not between 1 and 999
      or (item->>'qty')::numeric <> trunc((item->>'qty')::numeric)
      or (item->>'price')::numeric not between 0 and 100000
      or jsonb_typeof(item->'note') is distinct from 'string' or length(item->>'note') > 300
      or not exists(select 1 from recipes where id=(item->>'recipe_id')::uuid and business_id=new.business_id and user_id=new.user_id) then
      raise exception 'Invalid order item';
    end if;
  end loop;
  return new;
end $$;
create trigger validate_delivery_items before insert on public.delivery_orders for each row execute function public.validate_delivery_items();
-- Updates only through the transition function; prevents skipping states/bookkeeping.
create function public.advance_delivery_order(p_id uuid, p_business uuid, p_from text, p_to text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ((p_from='new' and p_to in ('cooking','cancelled')) or
    (p_from='cooking' and p_to='ready') or (p_from='ready' and p_to='delivered')) then
    raise exception 'Invalid transition';
  end if;
  update delivery_orders set status=p_to where id=p_id and business_id=p_business
    and user_id=auth.uid() and status=p_from
    and exists(select 1 from businesses where id=p_business and user_id=auth.uid());
  if not found then raise exception 'Order changed. Refresh and try again.'; end if;
end $$;
revoke all on function public.advance_delivery_order(uuid,uuid,text,text) from public;
grant execute on function public.advance_delivery_order(uuid,uuid,text,text) to authenticated;

alter table public.sales add column delivery_order_id uuid references public.delivery_orders(id);
create index sales_delivery_order on public.sales(delivery_order_id);
-- Existing sale deletion would restore stock without reopening the order.
-- Keep linked records intact until a transactional refund workflow is available.
create function public.protect_delivery_sale() returns trigger language plpgsql as $$
begin
  if old.delivery_order_id is not null then
    if TG_OP = 'DELETE' then raise exception 'Delivery sales cannot be deleted; update payment status instead'; end if;
    if new.delivery_order_id is distinct from old.delivery_order_id or new.recipe_id <> old.recipe_id
      or new.qty_bottles <> old.qty_bottles or new.price_charged_total <> old.price_charged_total
      or new.business_id <> old.business_id or new.user_id <> old.user_id then
      raise exception 'Delivery sale quantities and links cannot be changed';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_delivery_sale before update or delete on public.sales for each row execute function public.protect_delivery_sale();
-- Runs all sales inserts, existing stock triggers, and the booking marker in one
-- transaction. A failed stock check rolls everything back. Row lock makes retry safe.
create function public.book_delivery_order(p_id uuid, p_business uuid, p_costs jsonb, p_fee numeric)
returns void language plpgsql security definer set search_path = public as $$
declare o delivery_orders; item jsonb; c numeric; sale_id uuid;
begin
  if p_fee is null or p_fee < 0 or p_fee > 100 then raise exception 'Invalid fee'; end if;
  if not exists(select 1 from businesses where id=p_business and user_id=auth.uid()) then raise exception 'Business not found'; end if;
  select * into o from delivery_orders where id=p_id and business_id=p_business and user_id=auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.booked_at is not null then return; end if;
  if o.status <> 'delivered' then raise exception 'Order must be delivered'; end if;
  perform 1 from finished_goods_stock where recipe_id in
    (select (value->>'recipe_id')::uuid from jsonb_array_elements(o.items)) order by recipe_id for update;
  perform 1 from ingredients where id in
    (select ri.ingredient_id from recipe_ingredients ri join recipes r on r.id=ri.recipe_id
     where r.is_made_to_order and r.id in (select (value->>'recipe_id')::uuid from jsonb_array_elements(o.items)))
    order by id for update;
  for item in select value from jsonb_array_elements(o.items) loop
    if not exists(select 1 from recipes where id=(item->>'recipe_id')::uuid and business_id=p_business and user_id=auth.uid()) then
      raise exception 'Recipe not found';
    end if;
    c := (p_costs->>(item->>'recipe_id'))::numeric;
    if c is null or c < 0 then raise exception 'Missing recipe cost'; end if;
    insert into sales(user_id,business_id,recipe_id,qty_bottles,price_charged_total,
      platform,platform_fee_pct,payment_status,sale_date,cost_per_bottle_snapshot,notes,delivery_order_id)
    values(auth.uid(),p_business,(item->>'recipe_id')::uuid,(item->>'qty')::numeric,
      (item->>'qty')::numeric*(item->>'price')::numeric,o.channel,p_fee,'pending',
      (o.created_at at time zone 'Asia/Bangkok')::date,c,concat(o.reference,' ',item->>'note'),o.id)
    returning id into sale_id;
    if exists(select 1 from recipes where id=(item->>'recipe_id')::uuid and is_made_to_order) then
      insert into sale_ingredient_usage(sale_id,ingredient_id,qty_used)
        select sale_id,ri.ingredient_id,ri.qty_used*(item->>'qty')::numeric
        from recipe_ingredients ri where ri.recipe_id=(item->>'recipe_id')::uuid;
    end if;
  end loop;
  update delivery_orders set booked_at=now() where id=o.id;
end $$;
revoke all on function public.book_delivery_order(uuid,uuid,jsonb,numeric) from public;
grant execute on function public.book_delivery_order(uuid,uuid,jsonb,numeric) to authenticated;

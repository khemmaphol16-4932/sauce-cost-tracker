-- ONE-SHOT DATA FIX — read this before running anything.
--
-- Nine purchases were logged at a placeholder ฿1 on 2026-08-17 because the app
-- had no way to correct a stock count (see 0017). recalc_ingredient_on_purchase
-- folded them into avg_price_per_unit, understating real ingredient cost by up
-- to 87%. This converts them into stock_adjustments ledger rows and restores
-- the true weighted average.
--
-- RUN 0017 FIRST, and deploy the app code that ships with it, so the operator
-- has a working Count button before this removes the ฿1 workaround.
--
-- Kept separate from 0017 deliberately: 0017 is pure re-runnable schema, this
-- is destructive and runs once.
--
-- Why qty_on_hand is never touched below: those quantities were the operator's
-- intended correction and are already reflected in current stock. There is no
-- UPDATE/DELETE trigger on purchases (only AFTER INSERT), so deleting these
-- rows changes nothing on its own — only avg_price_per_unit needs fixing, and
-- that column is a full recompute from surviving purchase rows.

-- ─────────────────────────────────────────────────────────────
-- STEP 1 — REVIEW. Run this alone first.
--
-- Do NOT proceed unless it returns exactly 9 rows. `avg_now` vs `avg_after`
-- shows what each ingredient's cost becomes; every value should go UP (that is
-- the understatement being undone). A NULL `avg_after` means every purchase
-- for that ingredient was a placeholder — it will be set to 0 by step 2, and
-- needs a real price the next time it's bought.
-- ─────────────────────────────────────────────────────────────

-- select p.id, i.name, p.qty_bought, i.unit, p.price_paid_total, p.purchase_date,
--        i.avg_price_per_unit as avg_now,
--        (select sum(x.price_paid_total) / nullif(sum(x.qty_bought), 0)
--           from purchases x
--          where x.ingredient_id = p.ingredient_id
--            and not (x.price_paid_total <= 2 and x.purchase_date = date '2026-08-17')
--        ) as avg_after
-- from purchases p
-- join ingredients i on i.id = p.ingredient_id
-- where p.price_paid_total <= 2
--   and p.purchase_date = date '2026-08-17'
-- order by i.name;

-- ─────────────────────────────────────────────────────────────
-- STEP 2 — CONVERT. Run after the review above looks right.
--
-- Safe to run twice: the second run matches no rows, and the recompute is a
-- pure function of the surviving purchases, so it is a no-op.
--
-- The predicate needs BOTH conditions. `price_paid_total <= 2` alone would
-- also catch a genuine ฿2 purchase of a small quantity; the known date scopes
-- it to the actual placeholder batch.
-- ─────────────────────────────────────────────────────────────

begin;

with bad as (
  select p.id, p.user_id, p.ingredient_id, p.qty_bought, p.purchase_date, i.business_id
  from purchases p
  join ingredients i on i.id = p.ingredient_id
  where p.price_paid_total <= 2
    and p.purchase_date = date '2026-08-17'
),
logged as (
  -- user_id is taken from the purchase row, NOT the auth.uid() column default:
  -- in the Supabase SQL Editor auth.uid() is NULL, which would violate NOT NULL.
  insert into stock_adjustments
    (user_id, business_id, kind, ingredient_id, delta, resulting_qty, reason, notes, adjustment_date)
  select b.user_id, b.business_id, 'ingredient', b.ingredient_id, b.qty_bought, null,
         'recount',
         'Migrated from placeholder ฿1 purchase (0018_cleanup_placeholder_purchases)',
         b.purchase_date
  from bad b
  returning ingredient_id
),
removed as (
  delete from purchases where id in (select id from bad)
  returning ingredient_id
)
select count(*) as converted from removed;

-- Same expression as recalc_ingredient_on_purchase (0001), with coalesce to
-- honour the NOT NULL DEFAULT 0 when an ingredient has no priced purchases
-- left — 0 is what a never-purchased ingredient reads, and it is the honest
-- value when there is no price evidence.
update ingredients i
set avg_price_per_unit = coalesce(
  (select sum(p.price_paid_total) / nullif(sum(p.qty_bought), 0)
     from purchases p
    where p.ingredient_id = i.id),
  0
)
where exists (
  select 1 from stock_adjustments sa
  where sa.ingredient_id = i.id
    and sa.notes like 'Migrated from placeholder%'
);

commit;

-- ─────────────────────────────────────────────────────────────
-- STEP 3 — VERIFY.
-- ─────────────────────────────────────────────────────────────

-- Expect 0:
-- select count(*) from purchases
--  where price_paid_total <= 2 and purchase_date = date '2026-08-17';

-- Expect 9:
-- select count(*) from stock_adjustments where notes like 'Migrated from placeholder%';

-- Every row: avg_price_per_unit must equal recomputed, and must be HIGHER than
-- the avg_now captured in step 1. qty_on_hand must be unchanged. Any row with
-- purchases_left = 0 shows avg 0 and needs a real price on next purchase.
-- select i.name, i.unit, i.qty_on_hand, i.avg_price_per_unit,
--        coalesce((select sum(p.price_paid_total) / nullif(sum(p.qty_bought), 0)
--                    from purchases p where p.ingredient_id = i.id), 0) as recomputed,
--        (select count(*) from purchases p where p.ingredient_id = i.id) as purchases_left
--   from ingredients i
--  where exists (select 1 from stock_adjustments sa
--                 where sa.ingredient_id = i.id
--                   and sa.notes like 'Migrated from placeholder%');

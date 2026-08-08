-- One-off seed: imports "เส้นเย็นญี่ปุ่น by ครัวบ้านจิ้ม" from the user's
-- existing accounting spreadsheet (บัญชี.xlsx) into the new multi-business
-- schema. Run this AFTER 0005_businesses.sql.
--
-- Purchases are logged at the ACTUAL price paid (after Shopee/Lotus app
-- discounts), matching what avg_price_per_unit is meant to represent —
-- money actually spent, not the listed/tag price.
--
-- This seeds the business + all 11 ingredients + their purchases only — the
-- factual data straight off the sheet. It deliberately does NOT create a
-- recipe: the sheet is a flat ingredient cost list, not a bill of materials,
-- so which noodle + which toppings actually make up each menu item (e.g.
-- อุด้งเย็น vs. โซบะเย็น, with/without กุ้งเทมปุระ) is something only you
-- know. Build each actual recipe in the app itself (Recipes tab, after
-- switching to this business) by picking the right ingredients and
-- quantities per dish — the two container rows (ถ้วยใส่อาหาร / ถ้วยน้ำจิ้ม)
-- go in as that recipe's packaging costs at ฿2.36 and ฿1.10 per container
-- (already the actual after-discount cost per single container, taken
-- straight from the sheet).
--
-- If you do want one combined recipe with everything in it as a quick way to
-- see the numbers, set the recipe's batch volume AND bottle size to 1 —
-- that makes the app's batch-costing math ("cost per bottle") come out as
-- "cost per one assembled serving" instead, since noodle bowls are
-- assembled per order rather than brewed in a batch and bottled.
--
-- IMPORTANT: replace YOUR_USER_ID_HERE below with your real user id first.
-- Find it by running this in a separate query:
--   select id, email from auth.users;
-- This script runs in the SQL Editor as the service role, not as your
-- logged-in session, so auth.uid() is not available here — every row needs
-- the user_id set explicitly.

do $$
declare
  v_user_id uuid := 'YOUR_USER_ID_HERE'; -- <-- replace this
  v_business_id uuid;
  v_udon uuid;
  v_soba uuid;
  v_yellow_noodle uuid;
  v_sauce uuid;
  v_water uuid;
  v_scallion uuid;
  v_wasabi uuid;
  v_nori uuid;
  v_shrimp_tempura uuid;
  v_crab_stick uuid;
  v_egg uuid;
begin
  insert into businesses (user_id, name)
  values (v_user_id, 'เส้นเย็นญี่ปุ่น by ครัวบ้านจิ้ม')
  returning id into v_business_id;

  -- Ingredients + their one logged purchase each (qty/price straight off the sheet)
  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'เส้นอุด้ง', 'g.') returning id into v_udon;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_udon, 400, 69, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'เส้นโซบะ', 'g.') returning id into v_soba;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_soba, 320, 55.5, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'เส้นบะหมี่เหลือง', 'g.') returning id into v_yellow_noodle;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_yellow_noodle, 800, 101, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'น้ำซอส', 'ml.') returning id into v_sauce;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_sauce, 1500, 208, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'น้ำเปล่าผสมซอส', 'ml.') returning id into v_water;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_water, 9000, 145, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'ต้นหอม', 'g.') returning id into v_scallion;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_scallion, 60, 10, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'วาซาบิ', 'g.') returning id into v_wasabi;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_wasabi, 300, 117, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'สาหร่าย', 'g.') returning id into v_nori;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_nori, 100, 132, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'กุ้งเทมปุระ', 'g.') returning id into v_shrimp_tempura;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_shrimp_tempura, 320, 145, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'ปูอัด', 'g.') returning id into v_crab_stick;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_crab_stick, 1000, 165, current_date);

  insert into ingredients (user_id, business_id, name, unit) values
    (v_user_id, v_business_id, 'ไข่', 'g.') returning id into v_egg;
  insert into purchases (user_id, ingredient_id, qty_bought, price_paid_total, purchase_date)
    values (v_user_id, v_egg, 500, 60, current_date);
end $$;

-- Reference for building recipes in the app (qty per serving, straight off
-- the sheet — "ปริมาณ / 1 ชุด"):
--   เส้นอุด้ง 100g · เส้นโซบะ 80g · เส้นบะหมี่เหลือง 100g · น้ำซอส 40ml ·
--   น้ำเปล่าผสมซอส 40ml · ต้นหอม 6g · วาซาบิ 3g · สาหร่าย 0.8g ·
--   กุ้งเทมปุระ 64g · ปูอัด 40g · ไข่ 50g
-- Packaging (already actual after-discount cost per single container):
--   ถ้วยใส่อาหาร + ฝา ฿2.36 · ถ้วยน้ำจิ้ม + ฝา ฿1.10

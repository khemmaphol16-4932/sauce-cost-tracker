-- Shop details printed on the bag label / receipt: logo, contact info, a
-- thank-you line, and whether the Sell cart should offer to print right
-- after each checkout. Lives on `businesses` because it is per-shop and the
-- existing businesses_update_own RLS policy already covers it.
--
-- The logo is stored as a small data: URL (the app resizes it to at most
-- 384px wide — the 58mm thermal print width — before saving, so it stays a
-- few KB). That avoids a storage bucket + its own policies for one image.
--
-- All columns are nullable/defaulted: the app reads them defensively, so
-- deploying the code before this migration runs just prints the old
-- name-only receipt instead of erroring.

alter table businesses
  add column if not exists logo_data_url text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists contact_line text,
  add column if not exists receipt_footer text,
  add column if not exists print_after_sale boolean not null default true;

alter table businesses
  add constraint businesses_logo_size check (logo_data_url is null or length(logo_data_url) <= 300000);

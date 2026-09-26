-- Link encoded in the QR code on the printed label/receipt (e.g. a Google
-- Form asking customers to rate the food). Run AFTER 0020 — it adds to the
-- same receipt-profile columns on businesses.
--
-- Nullable: with no link, the label simply prints without a QR code, and the
-- app reads it defensively so deploying before this runs doesn't error.
--
-- Numbering note: the unmerged review/print-station-prd branch also has a
-- 0021 (print_jobs), which is parked and must be renumbered before it is
-- ever applied.

alter table businesses
  add column if not exists feedback_url text;

alter table businesses
  drop constraint if exists businesses_feedback_url_format;
alter table businesses
  add constraint businesses_feedback_url_format
  check (feedback_url is null or (feedback_url ~ '^https?://' and length(feedback_url) <= 500));

-- Adds a customer/room identifier to sales, needed for repeat-customer
-- retention analytics (src/lib/data/analytics.ts). Optional field — leave
-- blank for walk-in/anonymous sales.
alter table sales add column if not exists customer_ref text;

-- Adds a cost-per-bottle snapshot to batches, captured at log time, so batch
-- history shows the actual cost as it was when cooked (ingredient avg prices
-- drift over time as new purchases come in).

alter table batches add column if not exists cost_per_bottle_snapshot numeric;

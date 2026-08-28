-- Checkout compatibility: some deployed schemas predate the product weight
-- column used by create_customer_order to compute the delivery quote.
-- This is schema-only: it performs no UPDATE, INSERT, or DELETE on production rows.
begin;

alter table public.products
  add column if not exists weight_kg numeric(8,3) not null default 0.250
  check (weight_kg > 0 and weight_kg <= 100);

comment on column public.products.weight_kg is
  'Shipping weight in kilograms. Legacy products use the conservative 0.250 kg default.';

notify pgrst, 'reload schema';

commit;

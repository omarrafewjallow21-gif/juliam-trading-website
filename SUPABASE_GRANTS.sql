-- Optional: run only if the browser app returns permission denied
-- This grants table privileges to signed-in users. RLS still restricts rows
-- to accounts whose public.profiles.role is exactly 'manager'.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.customers,
  public.shipments,
  public.shipping_regions,
  public.weight_bands,
  public.tariffs,
  public.commissions,
  public.commission_payments,
  public.profiles,
  public.activity_logs
TO authenticated;

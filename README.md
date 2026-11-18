# JULIAM TRADING Shipment Management System

A browser-based shipment management portal using Supabase Authentication and Database.

## Included in this version

- Supabase manager sign-in and sign-out
- Dashboard with shipment, revenue, commission and delivery summaries
- Customer directory and CSV export
- Paid-only shipment registration
- Unique receipt references and printable JULIAM TRADING receipts
- Shipment status and DHL tracking-number updates
- Tariff setup: regions, weight bands and prices
- 15% commission reporting and commission receipt records
- Financial date filtering and CSV export
- Outstanding shipment manifest
- Activity log
- JSON backup download
- Responsive black, gold and white interface

## 1. Configure Supabase

Open `config.js` and replace the two placeholders:

- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_ANON_KEY`: Supabase Publishable key or legacy anon key

Find these in Supabase Project Settings / API (or API Keys).

**Never use the `service_role` / secret key in browser code. Never publish your database password.**

## 2. Database

This project expects the nine public tables created in the setup conversation:

`customers`, `shipments`, `shipping_regions`, `weight_bands`, `tariffs`, `commissions`, `commission_payments`, `profiles`, `activity_logs`.

It also expects the commission trigger and manager RLS policies.

If queries return permission errors, check that:
- Your manager user exists in Supabase Authentication.
- `profiles.id` matches that Auth user's UUID.
- `profiles.role` is exactly `manager` (lowercase).
- Row Level Security is enabled and manager policies exist.
- The `authenticated` role has table privileges. Supabase SQL Editor can run:

```sql
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.customers, public.shipments, public.shipping_regions,
  public.weight_bands, public.tariffs, public.commissions,
  public.commission_payments, public.profiles, public.activity_logs
TO authenticated;
```

Do not grant these permissions to `anon`.

## 3. Run locally

Open the folder in VS Code. Use the Live Server extension and choose **Open with Live Server** on `index.html`. You can also use any static local web server.

## 4. Deploy

Push the project to your private GitHub repository. For a free static host, use Cloudflare Pages and connect the GitHub repository. Configure no build command and set the output directory to `/` (the repository root). Check the host's current terms for commercial use before publishing.

## Important operational notes

- The database schema currently enforces shipment payment status as `PAID`; the UI also requires a payment confirmation checkbox.
- Commission is calculated by the database trigger at 15% of the amount at the time the shipment is created.
- If the shipment amount is later edited directly in the database, the existing commission record is not automatically recalculated. This first version does not provide shipment editing or deletion.
- Tariff entries are manually maintained. This version does not yet automatically calculate the amount from the tariff table.
- Tariffs must be confirmed with JULIAM TRADING / IRO Shipping before use. Do not assume sample or old rates are valid.
- A commission payment is a record of money received against earned commission; the system does not automatically allocate receipts to individual commission rows.
- DHL tracking numbers are stored for staff reference. This app does not connect to the DHL API and does not verify tracking status.
- Receipts are JULIAM TRADING receipts, not DHL-issued waybills.
- JSON backup is a download. Store it securely because it contains personal customer information. Restore is intentionally not automated in this first version to avoid accidental duplicate records.
- Supabase Free may pause inactive projects and does not include automatic backups. Export and securely store backups regularly.

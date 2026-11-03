# NEO Dental Clinic — Setup & Deploy

## 1. Database (Supabase SQL Editor, in order)
1. `drizzle/migrations/0000_clinic_schema.sql` (already run if Lovable created tables)
2. `drizzle/migrations/0001_clinic_features.sql`  <- NEW: RLS fixes, reminder log, views, dashboard RPCs, money guards

## 2. First owner
1. Supabase > Authentication > Users > Add user (email + password)
2. Authentication > Providers > Email > turn OFF "Allow new users to sign up"
3. Run (your email):
   `insert into public.user_roles (user_id, role) select id,'owner' from auth.users where email='YOU@EMAIL' on conflict do nothing;`
4. After that, add managers from Settings > Users (needs `SUPABASE_SERVICE_ROLE_KEY` server env var).

## 3. Env vars
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never VITE_).

## 4. Checklist before go-live
- [ ] Sign-ups disabled; manager login tested (no Employees page, no revenue/profit on dashboard)
- [ ] Test on a real 360px phone; Add to Home Screen (PWA)
- [ ] Enable Supabase daily backups; set a strong owner password
- [ ] `npm run build` and `npm test` pass

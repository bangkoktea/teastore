# 5 O'CLOCK — Vercel shop

Static shop + Lalamove quote (serverless).

## Deploy
1. Import to **Vercel** -> Framework: *Other*.
2. Project → Settings → **Environment Variables**:
   - `LALAMOVE_API_KEY` = pk_xxx
   - `LALAMOVE_API_SECRET` = sk_xxx
   - `LALAMOVE_MARKET` = TH
   - `LALAMOVE_COUNTRY` = BKK
   - `LALAMOVE_BASE_URL` = https://rest.sandbox.lalamove.com
3. Redeploy and open the site. Fill address with Bangkok + optionally paste coordinates like `@13.7563, 100.5018` to get a quote.
4. Click **Order via LINE** to open a prefilled chat.

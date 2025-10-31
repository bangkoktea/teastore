# 5 o’clock — GitHub Pages (no server, no secrets)

Pure static site. Delivery price is a local approximation (no Lalamove API).
Paste a Google Maps link that contains `@lat,lng` into the Address field to get an estimate.

**Deploy**
1) Create a repo and upload all files.
2) Settings → Pages → Branch: `main` (or `master`), Folder: `/root`.
3) Open the Pages URL.

Adjust price formula in `app.js` → `estimateLocal()`.

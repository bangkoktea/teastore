// /api/lalamove-quote.js — Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  try {
    const {
      LALAMOVE_API_KEY,
      LALAMOVE_API_SECRET,
      LALAMOVE_MARKET = 'TH',
      LALAMOVE_COUNTRY = 'BKK',
      LALAMOVE_BASE_URL = 'https://rest.sandbox.lalamove.com'
    } = process.env;

    if (!LALAMOVE_API_KEY || !LALAMOVE_API_SECRET) {
      return res.status(500).json({ ok:false, error: 'Missing Lalamove keys' });
    }
    const { pickup, dropoff, serviceType = 'MOTORCYCLE' } = req.body || {};
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return res.status(400).json({ ok:false, error: 'Bad coords' });
    }
    const path = '/v3/quotations';
    const url  = `${LALAMOVE_BASE_URL}${path}`;
    const requestTime = new Date().toISOString();
    const payload = {
      serviceType,
      specialRequests: [],
      stops: [
        { coordinates: { lat: String(pickup.lat),  lng: String(pickup.lng)  } },
        { coordinates: { lat: String(dropoff.lat), lng: String(dropoff.lng) } },
      ],
      requesterContact: { name: "5 o'clock Tea", phone: "0000000000" },
      metadata: {}
    };
    const body = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const rawToSign = `${body}
${requestTime}
${path}
POST
${LALAMOVE_API_KEY}`;
    const signature = crypto.createHmac('sha256', LALAMOVE_API_SECRET).update(rawToSign).digest('hex');
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-LLM-Country': LALAMOVE_MARKET,
      'X-LLM-Market':  LALAMOVE_COUNTRY,
      'X-Request-Time': requestTime,
      'Authorization': `hmac ${LALAMOVE_API_KEY}:${signature}`
    };
    const llmRes = await fetch(url, { method: 'POST', headers, body });
    const text   = await llmRes.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    if (!llmRes.ok) {
      return res.status(llmRes.status).json({ ok:false, status: llmRes.status, error: data || text });
    }
    const priceTHB = Number(data?.data?.priceBreakdown?.total || data?.data?.price || 0);
    const distanceKm = Number(data?.data?.distanceInMeters ? data.data.distanceInMeters/1000 : (data?.data?.distance || 0));
    return res.status(200).json({ ok:true, priceTHB, distanceKm, raw:data });
  } catch (err) {
    return res.status(500).json({ ok:false, error: String(err && err.message || err) });
  }
}

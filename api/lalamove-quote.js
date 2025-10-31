// /api/lalamove-quote.js (Vercel Serverless Function)
import crypto from "crypto";

// Хелпер: нормальный ответ
function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*"); // можно сузить на твой домен
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    const {
      pickup = { lat: 13.6948, lng: 100.7186 }, // твой склад
      dropoff,                                   // {lat, lng}
      serviceType = "MOTORCYCLE",
      stops = []                                  // опционально: промежуточные точки
    } = req.body || {};

    if (!dropoff || typeof dropoff.lat !== "number" || typeof dropoff.lng !== "number") {
      return json(res, 400, { ok: false, error: "Bad dropoff coords" });
    }

    // === ENV ===
    const API_KEY    = process.env.LALAMOVE_API_KEY;      // pk_...
    const API_SECRET = process.env.LALAMOVE_API_SECRET;   // sk_...
    const MARKET     = process.env.LALAMOVE_MARKET || "TH_BKK"; // пример: TH_BKK (Бангкок)
    const COUNTRY    = process.env.LALAMOVE_COUNTRY || "TH";    // TH
    const BASE_URL   = process.env.LALAMOVE_BASE_URL || "https://sandbox-rest.lalamove.com"; 
    // ^ для продакшна провайдер даст боевой base URL

    if (!API_KEY || !API_SECRET) {
      return json(res, 500, { ok: false, error: "Missing Lalamove keys" });
    }

    // === Тело запроса под /v3/quotations ===
    // NB: структура близка к текущей доке Lalamove v3 (может слегка отличаться — оставил логи/эхо для дебага)
    const path = "/v3/quotations";
    const body = {
      serviceType,        // "MOTORCYCLE" или "CAR" и т.п.
      market: MARKET,     // напр. "TH_BKK"
      // набор точек от pickUp к dropOff (и опциональные промежуточные)
      stops: [
        { coordinates: { lat: pickup.lat, lng: pickup.lng } },
        ...(Array.isArray(stops) ? stops : []),
        { coordinates: { lat: dropoff.lat, lng: dropoff.lng } }
      ],
      // можно добавить requesterContact / deliveriesHints / isRouteOptimized и др. — пока упрощённо
    };

    const timestamp = Date.now().toString();
    // Формула подписи (часто встречающийся вариант для Lalamove v3):
    // signRaw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${JSON.stringify(body)}`
    const signRaw = `${timestamp}\r\nPOST\r\n${path}\r\n\r\n${JSON.stringify(body)}`;
    const signature = crypto
      .createHmac("sha256", API_SECRET)
      .update(signRaw)
      .digest("base64");

    const url = BASE_URL + path;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      // разные аккаунты используют разные схемы авторизации:
      // Вариант 1 (частый): X-Request-ID + X-Timestamp + X-LLM-Country + Authorization: hmac <key>:<sig>
      "X-Request-ID": crypto.randomUUID(),
      "X-Timestamp": timestamp,
      "X-LLM-Country": COUNTRY,
      "Authorization": `hmac ${API_KEY}:${signature}`,
    };

    // Делаем запрос на Lalamove
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      // Вернём наружу детали, чтобы можно было быстро поправить подпись/market
      return json(res, r.status, { ok: false, status: r.status, error: data || text, sent: { url, headers, body } });
    }

    // Ожидаем, что Lalamove вернёт структуру с ценой/ETA.
    // Нормализуем в универсальный ответ для фронта:
    const priceTHB =
      Number(data?.quotationTotalFee?.amount) ||
      Number(data?.priceBreakdown?.total) ||
      Number(data?.totalFee) || null;

    const etaMin =
      Number(data?.estimatedPickupTimeInMinutes) ||
      Number(data?.etaInMinutes) || null;

    return json(res, 200, {
      ok: true,
      provider: "lalamove",
      priceTHB,
      etaMin,
      raw: data, // оставим для прозрачноcти — удобно дебажить в DevTools
    });

  } catch (err) {
    return json(res, 500, { ok: false, error: String(err?.message || err) });
  }
}

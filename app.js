// app.js (clean, fixed)

// ---- config / state / refs ----
const API_ORIGIN = location.origin;

async function loadConfig() {
  const r = await fetch('./data/products.json');
  return r.json();
}

const state = { config: null, cart: [], lastQuote: null };

const els = {
  grid:      document.getElementById('productGrid'),
  drawer:    document.getElementById('cartDrawer'),
  open:      document.getElementById('openCart'),
  close:     document.getElementById('closeCart'),
  closeBtn:  document.getElementById('closeCartBtn'),
  items:     document.getElementById('cartItems'),
  count:     document.getElementById('cartCount'),
  subtotal:  document.getElementById('cartSubtotal'),
  shipping:  document.getElementById('shippingCost'),
  total:     document.getElementById('cartTotal'),
  checkout:  document.getElementById('checkoutBtn'),
  addr:      document.getElementById('address'),
  name:      document.getElementById('custName'),
  phone:     document.getElementById('custPhone'),
  district:  document.getElementById('district'), // NEW
};

// ---- utils ----
function fmtTHB(v) { return 'THB ' + Number(v).toLocaleString('en-US'); }

// ---- CLIENT-ONLY DELIVERY ESTIMATOR (no servers, no keys) ----
const DELIVERY = {
  baseTHB: 30,        // базовая часть
  perKmTHB: 12,       // за км
  minTHB: 70,         // минимум
  freeThreshold: 500, // бесплатная доставка от суммы корзины
  maxKm: 25           // максимум для расчёта
};

// ===== AREAS (dropdown) =====
const DISTRICTS = {
  RAMKHAM:     { label: "Ramkhamhaeng / Bang Kapi / Hua Mak", km: 3 },
  LADPHRAO:    { label: "Ladprao / Lat Krabang / On Nut / Suan Luang", km: 8 },
  SUKHUMVIT:   { label: "Sukhumvit (Asoke–Phra Khanong)", km: 15 },
  SILOM:       { label: "Bang Rak / Silom / Sathorn", km: 18 },
  BANGNA:      { label: "Bang Na (incl. 10260–10270)", km: 21 }, // 21 км ≈ ~160฿
  SAMUTPRAKAN: { label: "Samut Prakan", km: 21 },
  NONTHABURI:  { label: "Nonthaburi", km: 23 },
  PATHUM:      { label: "Rangsit / Pathum Thani", km: 28 },
};

// Haversine (км) — если пользователь вставил координаты/ссылку
function haversineKm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat/2) ** 2 +
             Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
             Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}

// Парсим координаты из строки/ссылки
function parseLatLngFromText(text) {
  const s = (text || '').trim();
  let m = s.match(/@(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  m = s.match(/\b(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\b/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  m = s.match(/[?&]q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  return null;
}

// Вычисляем км по селекту или тексту адреса (ZIP/координаты)
function getKmFromDistrictOrText() {
  const code = (els.district?.value || '').trim();
  if (code && DISTRICTS[code]) return DISTRICTS[code].km;

  // попытка по ZIP
  const t = (els.addr?.value || '').toLowerCase();
  const zipMatch = t.match(/\b\d{5}\b/);
  if (zipMatch) {
    const zip = zipMatch[0];
    if (/^1026\d|1027\d$/.test(zip)) return 21; // Bang Na / Samut Prakan
    if (/^1011\d$/.test(zip))       return 15; // Sukhumvit core
    if (/^1050\d$/.test(zip))       return 18; // Silom/Sathon
    if (/^110\d\d$/.test(zip))      return 23; // Nonthaburi
    if (/^120\d\d$/.test(zip))      return 28; // Pathum Thani
    if (/^1024\d$/.test(zip))       return 3;  // Ramkhamhaeng area
    if (/^1025\d$/.test(zip))       return 8;  // Ladprao / On Nut etc
  }

  // попытка по координатам: считаем от точки магазина (state.config.pickup)
  const coords = parseLatLngFromText(els.addr?.value || '');
  if (coords && state?.config?.pickup) {
    const km = haversineKm(state.config.pickup, coords);
    return Math.round(km * 10) / 10;
  }

  return null;
}

// Обёртка, которую вызывает корзина (локальная логика, без ETA)
function estimateFromApi(_pickupIgnored, _dropoffIgnored, subtotalTHB = 0) {
  const freeThreshold = (state.config?.freeShippingThreshold ?? DELIVERY.freeThreshold);
  const kmDetected = getKmFromDistrictOrText();

  if (subtotalTHB >= freeThreshold) {
    window.state = window.state || {};
    window.state.shippingTHB = 0;
    window.state.distanceKm  = kmDetected ?? 0;
    return { ok:true, priceTHB:0, distanceKm:(kmDetected ?? 0) };
  }

  if (kmDetected == null) {
    window.state = window.state || {};
    window.state.shippingTHB = DELIVERY.minTHB;
    window.state.distanceKm  = 0;
    return { ok:false, priceTHB:DELIVERY.minTHB, distanceKm:0 };
  }

  const km = Math.min(kmDetected, DELIVERY.maxKm);
  let price = DELIVERY.baseTHB + DELIVERY.perKmTHB * km;
  if (price < DELIVERY.minTHB) price = DELIVERY.minTHB;
  price = Math.round(price / 5) * 5; // округлим до 5฿

  window.state = window.state || {};
  window.state.shippingTHB = price;
  window.state.distanceKm  = km;

  return { ok:true, priceTHB:price, distanceKm:km };
}
// ---- /CLIENT-ONLY DELIVERY ESTIMATOR ----


// ---- UI render ----
function renderProducts() {
  const cfg = state.config;
  cfg.items.forEach(p => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="row">
        <span class="small">Size</span>
        <select class="size">
          ${p.options.map((o, i) => `<option value="${i}">${o.label} — ${fmtTHB(o.price)}</option>`).join('')}
        </select>
      </div>
      <div style="padding:12px">
        <button class="btn ${p.outOfStock ? 'btn-purple' : 'btn-primary'} add" data-id="${p.id}">
          ${p.outOfStock ? 'Preorder' : 'Add to cart'}
        </button>
        ${p.outOfStock ? '<span class="badge">ETA 7–10 days</span>' : ''}
      </div>`;
    els.grid.appendChild(el);
  });
}

// ---- cart / totals ----
function updateCart() {
  els.items.innerHTML = '';

  // строки корзины + subtotal
  let subtotal = 0;
  state.cart.forEach((it, idx) => {
    if (it.id !== 'delivery') subtotal += it.price * it.qty;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <img src="${it.img}" alt="">
      <div style="flex:1">
        <div style="font-weight:600">
          ${it.name}${it.variant ? (' — ' + it.variant) : ''}${it.preorder ? '<span class="badge">PREORDER</span>' : ''}
        </div>
        <div class="small">${fmtTHB(it.price)} × ${it.qty}</div>
      </div>
      ${it.id === 'delivery' ? '' : `
        <div>
          <button data-act="dec" data-idx="${idx}">−</button>
          <button data-act="inc" data-idx="${idx}">+</button>
          <button data-act="del" data-idx="${idx}">✕</button>
        </div>`}
    `;
    els.items.appendChild(row);
  });

  const applyTotals = () => {
    const shipping =
      (state.lastQuote && state.lastQuote.ok && typeof state.lastQuote.priceTHB === 'number')
        ? state.lastQuote.priceTHB
        : (subtotal >= (state.config?.freeShippingThreshold ?? DELIVERY.freeThreshold) ? 0 : DELIVERY.minTHB);

    // обновим/вставим позицию Delivery
    const dIdx = state.cart.findIndex(x => x.id === 'delivery');
    if (shipping > 0) {
      const km = (typeof state.lastQuote?.distanceKm === 'number') ? `~${state.lastQuote.distanceKm} km` : 'Selected area';
      const it = { id: 'delivery', name: 'Delivery', variant: km, price: shipping, qty: 1, img: './images/delivery.png' };
      if (dIdx > -1) state.cart[dIdx] = it; else state.cart.push(it);
    } else if (dIdx > -1) {
      state.cart.splice(dIdx, 1);
    }

    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    els.subtotal.textContent = fmtTHB(subtotal);
    els.shipping.textContent = fmtTHB(shipping);
    els.total.textContent    = fmtTHB(total);

    const items = state.cart.filter(i => i.id !== 'delivery').reduce((s, i) => s + i.qty, 0);
    els.count.textContent = items;

    els.checkout.disabled = !(items > 0 && els.name.value.trim() && els.phone.value.trim() && els.addr.value.trim());
  };

  // ВСЕГДА считаем локально (без координат/сетевых вызовов)
  estimateFromApi(null, null, subtotal)
    .then(q => { state.lastQuote = q; applyTotals(); })
    .catch(() => { state.lastQuote = null; applyTotals(); });
}

// ---- LINE message ----
function buildOrderText() {
  const lines = state.cart
    .filter(i => i.id !== 'delivery')
    .map(i => `• ${i.name}${i.variant ? ` (${i.variant})` : ''}${i.preorder ? ' [PREORDER]' : ''} x${i.qty} — THB ${i.price}`)
    .join('\n');

  const subtotal = state.cart.filter(i => i.id !== 'delivery').reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = state.cart.find(i => i.id === 'delivery')?.price || 0;
  const total    = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

  const dist = (state.lastQuote && typeof state.lastQuote.distanceKm === 'number')
    ? `\nDistance approx: ${state.lastQuote.distanceKm.toFixed(1)} km`
    : '';

  return `Order from 5 o'clock Tea
${lines}

Subtotal: THB ${subtotal}
${delivery > 0 ? `Delivery: THB ${delivery}\n` : ''}Total: THB ${total}${dist}

Name: ${els.name.value.trim()}
Phone: ${els.phone.value.trim()}
Address: ${els.addr.value.trim()}`;
}

function openLine() {
  const msg = buildOrderText();
  const id = state.config.lineId;

  const https = 'https://line.me/R/oaMessage/' +
    encodeURIComponent(id) + '/?' +
    encodeURIComponent(msg).replace(/%0A/g, '%0A');

  const opened = window.open(https, '_blank');
  if (!opened) {
    navigator.clipboard.writeText(msg).catch(() => {});
    alert('Order text copied. Paste it into LINE chat.');
    window.open('https://line.me/R/ti/p/' + encodeURIComponent(id), '_blank');
  }
}

// ---- events ----
document.addEventListener('click', (e) => {
  const act = e.target.getAttribute('data-act');
  if (act) {
    const idx = parseInt(e.target.getAttribute('data-idx'), 10);
    if (act === 'inc') state.cart[idx].qty += 1;
    if (act === 'dec') state.cart[idx].qty = Math.max(1, state.cart[idx].qty - 1);
    if (act === 'del') { if (state.cart[idx].id !== 'delivery') state.cart.splice(idx, 1); }
    updateCart();
    return;
  }

  if (e.target.classList.contains('add')) {
    const card = e.target.closest('.card');
    const sel  = card.querySelector('.size');
    const pid  = e.target.getAttribute('data-id');
    const p    = state.config.items.find(x => x.id === pid);
    const opt  = p.options[parseInt(sel.value, 10)];

    const found = state.cart.find(i => i.id === pid && i.variant === opt.label);
    if (found) found.qty += 1;
    else state.cart.push({
      id: pid, name: p.name, variant: opt.label,
      price: opt.price, qty: 1, img: p.img, preorder: !!p.outOfStock
    });

    updateCart();
    els.drawer.classList.add('open');
  }
});

['input','change','blur'].forEach(ev => els.addr?.addEventListener(ev, updateCart));
['change'].forEach(ev => els.district?.addEventListener(ev, updateCart)); // NEW
['input','change','blur'].forEach(ev => els.name.addEventListener(ev, updateCart));
['input','change','blur'].forEach(ev => els.phone.addEventListener(ev, updateCart));

els.open.addEventListener('click',  () => els.drawer.classList.add('open'));
els.close.addEventListener('click', () => els.drawer.classList.remove('open'));
els.closeBtn.addEventListener('click', () => els.drawer.classList.remove('open'));
els.checkout.addEventListener('click', (e) => { e.preventDefault(); openLine(); });

// ---- boot ----
loadConfig().then(cfg => {
  state.config = cfg;
  renderProducts();
  updateCart();
});

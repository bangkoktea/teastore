/* 5 O'CLOCK — front */
const CONFIG = {
  currency: "THB",
  freeShippingThreshold: 500,
  pickup: { lat: 13.6948, lng: 100.7186 }, // 38/71 Indy Ramkhamhaeng 2, Dokmai, Prawet 10250
  lineId: "@924uwcib",
  products: [
    { id: "wild-cherry", name: "Wild Cherry", img: "./images/wild-cherry.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with cherry notes — bright and aromatic." },
    { id: "taiga-blend", name: "Taiga Blend", img: "./images/taiga-blend.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea, berries & forest vibes. Cozy and bold." },
    { id: "rose-strawberry", name: "Rose Strawberry Fruit Tea", img: "./images/rose-strawberry.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with apples, chokeberry, strawberry & rose petals." },
    { id: "rose-hibiscus", name: "Rose Hibiscus Fruit Tea", img: "./images/rose-hibiscus.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Hibiscus, rose petals & berries for a ruby‑red infusion.", outOfStock: true },
    { id: "citrus-orange", name: "Citrus Orange Fruit Tea", img: "./images/citrus-orange.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Sun‑dried oranges, apples & hibiscus for a refreshing citrus aroma.", outOfStock: true },
    { id: "strawberries-cream", name: "Strawberries & Cream", img: "./images/strawberries-cream.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with strawberry pieces, goji berries & candied pineapple." },
    { id: "tea-sampler", name: "Tea Sampler (3×20g)", img: "./images/wild-cherry.jpg", options: [{label:"Set", price:195}], desc: "Taiga + Strawberries & Cream + Wild Cherry (3×20g). Perfect to try." }
  ]
};
function fmt(v){ return CONFIG.currency + " " + Number(v).toLocaleString("en-US"); }

const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const closeCart = document.getElementById("closeCart");
const openCart = document.getElementById("openCart");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartSubtotal = document.getElementById("cartSubtotal");
const shippingCostEl = document.getElementById("shippingCost");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
const addrEl = document.getElementById("address");
const nameEl = document.getElementById("custName");
const phoneEl = document.getElementById("custPhone");

let cart = [];
let lastQuote = null;

function renderProducts(){
  CONFIG.products.forEach(p => {
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}">
      <div class="content">
        <h3 class="logo" style="margin:4px 0 6px 0">${p.name}</h3>
        ${p.outOfStock ? '<div class="note" style="color:#7c3aed;font-weight:600">Preorder only (ETA 7–10 days)</div>' : ""}
        <div class="muted" style="margin:6px 0 10px 0">${p.desc}</div>
        <div class="row">
          <select class="sizeSel pill">
            ${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join("")}
          </select>
          <button data-id="${p.id}" class="btn">${p.outOfStock? 'Preorder' : 'Add to cart'}</button>
        </div>
      </div>`;
    grid.appendChild(el);
  });
}

function estimateFromApi(pickup, dropoff){
  const body = JSON.stringify({ pickup, dropoff, serviceType: "MOTORCYCLE" });
  return fetch("/api/lalamove-quote", { method:"POST", headers:{ "Content-Type":"application/json" }, body })
    .then(r => { if (r.ok) return r.json(); throw new Error("vercel route failed"); })
    .catch(_ => ({ ok:false }));
}

function parseZipFromAddress(text){
  const m = (text||"").match(/\b10\d{3}\b/);
  return m ? m[0] : "";
}
function isBangkokArea(text){
  return /(bangkok|krung thep|nonthaburi|samut\s*prakan)/i.test(text || "");
}

function buildOrderMessage() {
  const lines = (cart || []).filter(i=>i.id!=='delivery').map(i =>
    `• ${i.name}${i.variant ? ' ('+i.variant+')' : ''}${i.preorder ? ' [PREORDER]' : ''} x${i.qty} — THB ${i.price}`
  ).join('\\n');

  const subtotal = (cart || []).reduce((s,i)=> i.id!=='delivery' ? s + i.price*i.qty : s, 0);
  const shipping = (lastQuote && lastQuote.ok && lastQuote.priceTHB!=null)
    ? lastQuote.priceTHB
    : (subtotal >= CONFIG.freeShippingThreshold ? 0 : 70);
  const total = subtotal + shipping;

  const name    = (nameEl?.value || '').trim();
  const phone   = (phoneEl?.value || '').trim();
  const address = (addrEl?.value || '').trim();

  const distanceNote = (lastQuote?.distanceKm!=null)
    ? (`\\nDistance (approx): ${Number(lastQuote.distanceKm).toFixed(1)} km`)
    : '';

  const text =
    "Order from 5 o'clock Tea\\n" + (lines||'(empty)') +
    `\\n\\nSubtotal: THB ${subtotal}` +
    (shipping>0 ? `\\nDelivery: THB ${shipping}` : '') +
    `\\nTotal: THB ${total}${distanceNote}` +
    `\\n\\nName: ${name}\\nPhone: ${phone}\\nAddress: ${address}`;

  return text;
}

function openLineWithMessage() {
  const msg = buildOrderMessage();
  const lineId = CONFIG.lineId;
  const httpsDeep = 'https://line.me/R/oaMessage/' + encodeURIComponent(lineId) + '/?' + encodeURIComponent(msg).replace(/%0A/g,'%0A');
  const appDeep   = 'line://oaMessage/' + encodeURIComponent(lineId) + '/?' + encodeURIComponent(msg).replace(/%0A/g,'%0A');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  let opened=false;
  if (mobile){ try{opened=!!window.open(appDeep,'_blank')}catch(e){} }
  if (!opened){ try{opened=!!window.open(httpsDeep,'_blank')}catch(e){} }
  if (!opened){ try{navigator.clipboard.writeText(msg)}catch(e){} alert('Order text copied. Paste it into LINE.'); }
}

/* TH phone auto +66 */
(function thPhoneAutoprefix(){
  const el = phoneEl; if (!el) return;
  function normalizeTH(v){
    if (!v) return '';
    let s = v.replace(/\\s+/g,'');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (s.startsWith('+66')) { s = '+66 ' + s.slice(3).replace(/^0+/, ''); return s; }
    if (s.startsWith('66'))  { s = '+66 ' + s.slice(2).replace(/^0+/, ''); return s; }
    if (s.startsWith('0'))   { s = '+66 ' + s.slice(1); return s; }
    return s.replace(/^\\+66$/, '+66 ').replace(/^\\+66(?=\\d)/, '+66 ');
  }
  el.addEventListener('focus', ()=>{ if (!el.value.trim()) { el.value = '+66 '; el.selectionStart = el.selectionEnd = el.value.length; } });
  const onChange = ()=>{ const a = normalizeTH(el.value); if (a!==el.value){ el.value=a; el.selectionStart = el.selectionEnd = el.value.length; } updateCart(); };
  el.addEventListener('input', onChange); el.addEventListener('paste', ()=>requestAnimationFrame(onChange)); el.addEventListener('blur', ()=>{ el.value = normalizeTH(el.value).trim(); });
})();

function updateCart(){
  cartItems.innerHTML = "";
  let subtotal = 0;
  for (const i of cart){ if (i.id!=="delivery") subtotal += i.price * i.qty; }

  cart.forEach((item,idx)=>{
    const row = document.createElement("div");
    row.style.display="flex"; row.style.gap="10px"; row.style.alignItems="center"; row.style.margin="10px 0";
    row.innerHTML = `
      <img src="${item.img}" style="width:64px;height:64px;object-fit:cover;border-radius:10px">
      <div style="flex:1">
        <div style="font-weight:600">${item.name}${item.variant?` — ${item.variant}`:""}${item.preorder?` <span class="note">PREORDER</span>`:""}</div>
        <div class="muted">${fmt(item.price)} × ${item.qty}</div>
      </div>
      ${item.id==="delivery" ? "" : `<div class="row">
        <button class="qtybtn" data-act="dec" data-idx="${idx}">−</button>
        <button class="qtybtn" data-act="inc" data-idx="${idx}">+</button>
        <button class="qtybtn" data-act="del" data-idx="${idx}">✕</button>
      </div>`}
    `;
    cartItems.appendChild(row);
  });

  const address = (addrEl.value||"").trim();
  const canQuote = parseZipFromAddress(address).startsWith("10") && isBangkokArea(address);
  let latlng = null;
  const at = address.match(/@(-?\\d+(\\.\\d+)?),\\s*(-?\\d+(\\.\\d+)?)/);
  if (at){ latlng = { lat: parseFloat(at[1]), lng: parseFloat(at[3]) }; }

  const finishTotals = ()=>{
    const shipping = (lastQuote && lastQuote.ok && typeof lastQuote.priceTHB==="number")
      ? lastQuote.priceTHB
      : (subtotal >= CONFIG.freeShippingThreshold ? 0 : 70);
    const dIdx = cart.findIndex(i => i.id==="delivery");
    if (shipping > 0){
      const deliveryItem = { id:"delivery", name:"Delivery", variant:"Local courier (estimate)", price:shipping, qty:1, img:"./images/delivery.png" };
      if (dIdx>-1) cart[dIdx] = deliveryItem; else cart.push(deliveryItem);
    } else if (dIdx>-1){
      cart.splice(dIdx,1);
    }
    const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
    cartSubtotal.textContent = fmt(subtotal);
    shippingCostEl.textContent = fmt(shipping);
    cartTotal.textContent = fmt(total);
    const itemsCount = cart.filter(i=>i.id!=="delivery").reduce((s,i)=>s+i.qty,0);
    cartCount.textContent = itemsCount;
    const ready = itemsCount>0 && nameEl.value.trim() && phoneEl.value.trim() && addrEl.value.trim();
    checkoutBtn.disabled = !ready; 
    document.getElementById('mobileCheckoutBtn').disabled = !ready;
  };

  (async ()=>{
    if (!canQuote || !latlng){ lastQuote = null; finishTotals(); return; }
    try{
      lastQuote = await estimateFromApi(CONFIG.pickup, latlng);
    }catch(_){ lastQuote = null; }
    finishTotals();
  })();
}

document.addEventListener("click", e => {
  const act = e.target.getAttribute("data-act");
  if (act){
    const idx = parseInt(e.target.getAttribute("data-idx"),10);
    if (act==="inc") cart[idx].qty += 1;
    if (act==="dec") cart[idx].qty = Math.max(1, cart[idx].qty - 1);
    if (act==="del"){ if (cart[idx].id!=="delivery") cart.splice(idx,1); }
    updateCart();
    return;
  }
  if (e.target.classList.contains("btn") && e.target.dataset.id){
    const card = e.target.closest(".card");
    const sel = card.querySelector(".sizeSel");
    const pid = e.target.getAttribute("data-id");
    const p = CONFIG.products.find(x=>x.id===pid);
    const opt = p.options[parseInt(sel.value,10)];
    const existing = cart.find(i=>i.id===pid && i.variant===opt.label);
    if (existing) existing.qty += 1;
    else cart.push({ id:pid, name:p.name, variant:opt.label, price:opt.price, qty:1, img:p.img, preorder: !!p.outOfStock });
    updateCart();
    cartDrawer.classList.add("open");
  }
});

openCart.addEventListener("click", ()=> cartDrawer.classList.add("open"));
closeCart.addEventListener("click", ()=> cartDrawer.classList.remove("open"));
["input","change","blur"].forEach(ev=> addrEl.addEventListener(ev, updateCart));
["input","change","blur"].forEach(ev=> nameEl.addEventListener(ev, updateCart));
["input","change","blur"].forEach(ev=> phoneEl.addEventListener(ev, updateCart));

function renderProductsInit(){ renderProducts(); updateCart(); }
renderProductsInit();

checkoutBtn.addEventListener("click", openLineWithMessage);
mobileCheckoutBtn.addEventListener("click", openLineWithMessage);

// ---- Config (no server needed) ----
const CONFIG = {
  currency: "THB",
  lineId: "@924uwcib",
  freeShippingThreshold: 500,
  pickup: { lat: 13.6948, lng: 100.7186 }, // Ramkhamhaeng 2 (your base)
  products: [
    { id:"wild-cherry",        name:"Wild Cherry",               img:"./images/wild-cherry.jpg",        options:[{label:"50 g", price:195}], desc:"Black tea with cherry notes — bright and aromatic." },
    { id:"taiga-blend",        name:"Taiga Blend",               img:"./images/taiga-blend.jpg",        options:[{label:"50 g", price:195}], desc:"Black tea, berries & forest vibes. Cozy and bold." },
    { id:"strawberries-cream", name:"Strawberry & Cream",        img:"./images/strawberries-cream.jpg", options:[{label:"50 g", price:195}], desc:"Black tea with strawberry pieces, goji berries & candied pineapple." },
    { id:"rose-strawberry",    name:"Rose Strawberry Fruit Tea", img:"./images/rose-strawberry.jpg",    options:[{label:"50 g", price:195}], desc:"Black tea with apples, chokeberry, strawberry & rose petals." },
    { id:"citrus-orange",      name:"Citrus Orange Fruit Tea",   img:"./images/citrus-orange.jpg",      options:[{label:"50 g", price:195}], desc:"Sun-dried oranges, apples & hibiscus for a refreshing citrus aroma." },
    { id:"rose-hibiscus",      name:"Rose Hibiscus Fruit Tea",   img:"./images/rose-hibiscus.jpg",      options:[{label:"50 g", price:195}], desc:"Hibiscus, rose petals & berries. Ruby-red infusion." },
    { id:"tea-sampler",        name:"Tea Sampler (3×20g) Set",   img:"./images/tea-sample.jpg",         options:[{label:"Set",   price:195}], desc:"Taiga + Strawberries & Cream + Wild Cherry (3×20g). Perfect to try." }
  ]
};

// Bangkok districts (50) with rough distance buckets from Ramkhamhaeng 2
const BKK_DISTRICTS = [
  ["Bang Kapi",8],["Hua Mak",5],["Saphan Sung",8],["Watthana",12],["Suan Luang",8],
  ["Lat Krabang",15],["Prawet",12],["Phra Khanong",12],["Bang Na",21],["Khlong Toei",14],
  ["Ratchathewi",14],["Pathum Wan",14],["Bang Rak",16],["Sathon",18],["Yan Nawa",18],
  ["Khan Na Yao",12],["Bueng Kum",10],["Lat Phrao",10],["Chatuchak",14],["Din Daeng",14],
  ["Huai Khwang",12],["Bang Sue",16],["Dusit",18],["Phaya Thai",15],["Bangkok Noi",22],
  ["Bangkok Yai",22],["Phasi Charoen",24],["Bang Khae",24],["Nong Khaem",26],["Taling Chan",24],
  ["Thawi Watthana",28],["Bangkhunthian",28],["Chom Thong",24],["Rat Burana",22],["Bang Kho Laem",18],
  ["Khlong San",18],["Thon Buri",20],["Bang Bon",28],["Thung Khru",25],["Chatu Chak (Mo Chit)",14],
  ["Min Buri",16],["Khlong Sam Wa",18],["Nong Chok",24],["Sai Mai",22],["Don Mueang",22],
  ["Bang Phlat",20],["Lak Si",20],["Phra Nakhon (Old Town)",18],["Pom Prap Sattru Phai",16],["Samphanthawong",16]
];

const DELIVERY = { base:30, perKm:12, min:70, maxKm:30 };

// ---- State & Refs ----
const els = {
  grid:      document.getElementById("productGrid"),
  drawer:    document.getElementById("cartDrawer"),
  open:      document.getElementById("openCart"),
  close:     document.getElementById("closeCart"),
  closeBtn:  document.getElementById("closeCartBtn"),
  items:     document.getElementById("cartItems"),
  count:     document.getElementById("cartCount"),
  subtotal:  document.getElementById("cartSubtotal"),
  shipping:  document.getElementById("shippingCost"),
  total:     document.getElementById("cartTotal"),
  checkout:  document.getElementById("checkoutBtn"),
  emailBtn:  document.getElementById("emailBtn"),  // может отсутствовать — проверяем дальше
  addr:      document.getElementById("address"),
  name:      document.getElementById("custName"),
  phone:     document.getElementById("custPhone"),
  district:  document.getElementById("district"),
};
const state = { cart:[], lastQuote:null };

// ---- Utils ----
const fmt = v => `${CONFIG.currency} ${Number(v).toLocaleString("en-US")}`;
function calcShippingByKm(km, subtotal){
  if (subtotal >= CONFIG.freeShippingThreshold) return 0;
  const k = Math.min(km, DELIVERY.maxKm);
  return Math.max(DELIVERY.min, Math.round(DELIVERY.base + DELIVERY.perKm * k));
}
function currentDistrictKm(){
  if (!els.district) return 0;
  const opt = els.district.options[els.district.selectedIndex];
  return opt ? Number(opt.dataset.km || 0) : 0;
}

// ---- Render products (stable layout) ----
function renderProducts(){
  CONFIG.products.forEach(p=>{
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" class="card__img" loading="lazy">
      <div class="card__body">
        <div class="card__title">${p.name}</div>
        <div class="card__desc">${p.desc}</div>
        <div class="row">
          <select class="select sizeSel">
            ${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join("")}
          </select>
          <button class="btn primary addBtn" data-id="${p.id}" type="button">Add to cart</button>
        </div>
      </div>
    `;
    els.grid.appendChild(card);
  });
}

// ---- Cart rendering / totals ----
function updateCart(){
  els.items.innerHTML = "";
  let subtotal = 0;

  state.cart.forEach((item, idx)=>{
    if (item.id !== "delivery") subtotal += item.price * item.qty;

    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <img src="${item.img}" alt="">
      <div class="meta">
        <div><strong>${item.name}</strong>${item.variant?` — ${item.variant}`:""}</div>
        <div class="tiny">${fmt(item.price)} × ${item.qty}</div>
      </div>
      ${item.id==="delivery" ? "" : `
      <div class="qty">
        <button class="qbtn" data-act="dec" data-idx="${idx}" type="button">−</button>
        <button class="qbtn" data-act="inc" data-idx="${idx}" type="button">+</button>
        <button class="qbtn" data-act="del" data-idx="${idx}" type="button">✕</button>
      </div>`}
    `;
    els.items.appendChild(row);
  });

  const km = currentDistrictKm();
  const shipping = calcShippingByKm(km, subtotal);

  // ensure single delivery line
  const dIdx = state.cart.findIndex(i=>i.id==="delivery");
  if (shipping > 0){
    const item = { id:"delivery", name:"Delivery", variant:`${km?`~${km} km`: "Local"}`, price:shipping, qty:1, img:"./images/delivery.png" };
    if (dIdx>-1) state.cart[dIdx]=item; else state.cart.push(item);
  } else if (dIdx>-1){
    state.cart.splice(dIdx,1);
  }

  const total = state.cart.reduce((s,i)=> s + i.price*i.qty, 0);
  els.subtotal.textContent = fmt(subtotal);
  els.shipping.textContent = fmt(shipping);
  els.total.textContent    = fmt(total);

  const itemsCount = state.cart.filter(i=>i.id!=="delivery").reduce((s,i)=>s+i.qty,0);
  els.count.textContent = itemsCount;

  els.checkout.disabled = !(itemsCount>0 && els.name.value.trim() && els.phone.value.trim() && els.addr.value.trim());

  // update email link (если на странице есть #emailBtn)
  const m = buildOrderMessage();
  if (els.emailBtn) {
    els.emailBtn.href = `mailto:5oclock@gmail.com?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text)}`;
  }
}

function buildOrderMessage(){
  const lines = state.cart
    .filter(i=>i.id!=="delivery")
    .map(i=>`• ${i.name}${i.variant?` (${i.variant})`:''} x${i.qty} — THB ${i.price}`)
    .join("\n");

  const subtotal = state.cart.filter(i=>i.id!=="delivery").reduce((s,i)=>s+i.price*i.qty,0);
  const total    = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const delivery = state.cart.find(i=>i.id==="delivery")?.price || 0;

  const text = `Order from 5 o'clock Tea
${lines}

Subtotal: THB ${subtotal}
${delivery>0?`Delivery: THB ${delivery}\n`:''}Total: THB ${total}

District: ${els.district?.value || '-'}
Name: ${els.name.value.trim()}
Phone: ${els.phone.value.trim()}
Address: ${els.addr.value.trim()}`;

  return { text, subject:`Order — 5 o'clock Tea (THB ${total})` };
}

function openLine(){
  const { text } = buildOrderMessage();
  const url = 'https://line.me/R/oaMessage/' + encodeURIComponent(CONFIG.lineId) + '/?' +
              encodeURIComponent(text).replace(/%0A/g,'%0A');
  const opened = window.open(url, '_blank');
  if (!opened) {
    navigator.clipboard?.writeText(text).catch(()=>{});
    alert('Order text copied. Paste it into LINE chat.');
    window.open('https://line.me/R/ti/p/'+encodeURIComponent(CONFIG.lineId),'_blank');
  }
}

// ---- Phone normalizer (+66, drop leading 0) ----
function normalizeThaiPhone() {
  if (!els.phone) return;
  let v = (els.phone.value || '').replace(/\s+/g, '');

  if (v.startsWith('0')) v = v.slice(1);
  if (!v.startsWith('+66')) {
    v = v.replace(/^\+*/, '');
    if (v.startsWith('66')) v = '+' + v;
    else v = '+66' + v;
  }
  if (v.length > 13) v = v.slice(0, 13);
  els.phone.value = v;
}

// ---- Events ----
document.addEventListener("click", e=>{
  const act = e.target.getAttribute("data-act");
  if (act){
    const idx = Number(e.target.getAttribute("data-idx"));
    if (act==="inc") state.cart[idx].qty += 1;
    if (act==="dec") state.cart[idx].qty = Math.max(1, state.cart[idx].qty-1);
    if (act==="del"){ if (state.cart[idx].id!=="delivery") state.cart.splice(idx,1); }
    updateCart();
    return;
  }

  // поддержим клик по вложенным элементам внутри кнопки
  const addBtn = e.target.closest && e.target.closest(".addBtn");
  if (addBtn){
    const card = addBtn.closest(".card");
    const sel  = card.querySelector(".sizeSel");
    const pid  = addBtn.getAttribute("data-id");
    const prod = CONFIG.products.find(p=>p.id===pid);
    const opt  = prod.options[Number(sel.value)];
    const found = state.cart.find(i=>i.id===pid && i.variant===opt.label);
    if (found) found.qty += 1;
    else state.cart.push({ id:pid, name:prod.name, variant:opt.label, price:opt.price, qty:1, img:prod.img });
    updateCart();
    els.drawer.classList.add("open"); // auto-open
  }
});

["input","change","blur"].forEach(ev=> els.name.addEventListener(ev, updateCart));
["input","change","blur"].forEach(ev=> els.phone.addEventListener(ev, ()=>{ normalizeThaiPhone(); updateCart(); }));
["input","change","blur"].forEach(ev=> els.addr.addEventListener(ev, updateCart));
els.district.addEventListener("change", updateCart);

els.open.addEventListener("click", ()=> els.drawer.classList.add("open"));
els.close.addEventListener("click", ()=> els.drawer.classList.remove("open"));
els.closeBtn.addEventListener("click", ()=> els.drawer.classList.remove("open"));
els.checkout.addEventListener("click", e=>{ e.preventDefault(); openLine(); });

// ---- Init ----
function bootDistricts(){
  if (!els.district) return;
  els.district.innerHTML = `<option value="">Select…</option>` +
    BKK_DISTRICTS.map(([name,km])=>`<option value="${name}" data-km="${km}">${name} (~${km} km)</option>`).join("");
}
function boot(){
  bootDistricts();
  renderProducts();
  if (els.phone && !els.phone.value.trim()) els.phone.value = '+66';
  normalizeThaiPhone();
  updateCart();
}
document.addEventListener("DOMContentLoaded", boot);

// ---- config / state ----
const state = { cfg: null, cart: [] };
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
  lineBtn:   document.getElementById('checkoutLine'),
  mailBtn:   document.getElementById('checkoutMail'),
  addr:      document.getElementById('address'),
  name:      document.getElementById('custName'),
  phone:     document.getElementById('custPhone'),
  district:  document.getElementById('district'),
};

const SHIP_BY_DISTRICT = {
  RAMKHAM: 70,
  LADPHRAO: 110,
  SUKHUMVIT: 140,
  SILOM: 150,
  BANGNA: 160,        // твой референс 21 км ≈ 160฿
  SAMUTPRAKAN: 160,
  NONTHABURI: 180,
  PATHUM: 210
};

const fmt = v => 'THB ' + Number(v||0).toLocaleString('en-US');

// ---- load config & render ----
async function boot(){
  const cfg = await fetch('./data/products.json').then(r=>r.json());
  state.cfg = cfg;
  renderProducts();
  wire();
  updateCart();
}
function renderProducts(){
  state.cfg.items.forEach(p=>{
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="row">
        <span class="lbl">Size</span>
        <select class="size">
          ${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join('')}
        </select>
      </div>
      <button class="add" data-id="${p.id}">Add to cart</button>
    `;
    els.grid.appendChild(el);
  });
}

// ---- cart logic ----
function updateCart(){
  els.items.innerHTML = '';
  let subtotal = 0;

  state.cart.forEach((it,idx)=>{
    if (it.id !== 'delivery') subtotal += it.price*it.qty;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <img src="${it.img}" alt="">
      <div style="flex:1">
        <div style="font-weight:600">${it.name}${it.variant?` — ${it.variant}`:''}</div>
        <div class="muted">${fmt(it.price)} × ${it.qty}</div>
      </div>
      ${it.id==='delivery' ? '' : `
        <div class="qty">
          <button class="counter" data-act="dec" data-idx="${idx}">−</button>
          <button class="counter" data-act="inc" data-idx="${idx}">+</button>
          <button class="counter" data-act="del" data-idx="${idx}">✕</button>
        </div>`}
    `;
    els.items.appendChild(row);
  });

  // shipping by district
  let shipping = 0;
  const sel = els.district.value;
  if (sel && subtotal < state.cfg.freeShippingTHB) shipping = SHIP_BY_DISTRICT[sel] || 0;

  // maintain "delivery" line
  const dIdx = state.cart.findIndex(i=>i.id==='delivery');
  if (shipping>0){
    const deliveryLine = { id:'delivery', name:'Delivery', variant:'District rate', price:shipping, qty:1, img:'./images/delivery.png' };
    if (dIdx>-1) state.cart[dIdx] = deliveryLine; else state.cart.push(deliveryLine);
  } else if (dIdx>-1){ state.cart.splice(dIdx,1); }

  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);

  els.subtotal.textContent = fmt(subtotal);
  els.shipping.textContent = fmt(shipping);
  els.total.textContent    = fmt(total);

  const itemsCount = state.cart.filter(i=>i.id!=='delivery').reduce((s,i)=>s+i.qty,0);
  els.count.textContent = itemsCount;

  const ready = itemsCount>0 && els.name.value.trim() && els.phone.value.trim() && els.addr.value.trim();
  els.lineBtn.disabled = !ready;
  els.mailBtn.disabled = !ready;
}

function buildMessage(){
  const lines = state.cart
    .filter(i=>i.id!=='delivery')
    .map(i=>`• ${i.name}${i.variant?` (${i.variant})`:''} x${i.qty} — THB ${i.price}`)
    .join('\n');

  const subtotal = state.cart.filter(i=>i.id!=='delivery').reduce((s,i)=>s+i.price*i.qty,0);
  const delivery = state.cart.find(i=>i.id==='delivery')?.price || 0;
  const total    = state.cart.reduce((s,i)=>s+i.price*i.qty,0);

  return `Order from 5 o'clock Tea
${lines}

Subtotal: THB ${subtotal}
${delivery>0?`Delivery: THB ${delivery}\n`:''}Total: THB ${total}

Name: ${els.name.value.trim()}
Phone: ${els.phone.value.trim()}
District: ${els.district.options[els.district.selectedIndex]?.text || '-'}
Address: ${els.addr.value.trim()}`;
}

// ---- events ----
function wire(){
  document.addEventListener('click', (e)=>{
    const act = e.target.getAttribute('data-act');
    if (act){
      const idx = +e.target.getAttribute('data-idx');
      if (act==='inc') state.cart[idx].qty += 1;
      if (act==='dec') state.cart[idx].qty = Math.max(1, state.cart[idx].qty-1);
      if (act==='del') { if (state.cart[idx].id!=='delivery') state.cart.splice(idx,1); }
      updateCart();
      return;
    }

    if (e.target.classList.contains('add')){
      const card = e.target.closest('.card');
      const pid  = e.target.getAttribute('data-id');
      const sizeSel = card.querySelector('.size');
      const p = state.cfg.items.find(x=>x.id===pid);
      const opt = p.options[+sizeSel.value];

      const found = state.cart.find(i=>i.id===pid && i.variant===opt.label);
      if (found) found.qty += 1;
      else state.cart.push({ id:pid, name:p.name, variant:opt.label, price:opt.price, qty:1, img:p.img });

      updateCart();
      els.drawer.classList.add('open'); // автооткрытие
    }
  });

  // open/close cart
  els.open.addEventListener('click', ()=> els.drawer.classList.add('open'));
  els.close.addEventListener('click', ()=> els.drawer.classList.remove('open'));
  els.closeBtn.addEventListener('click', ()=> els.drawer.classList.remove('open'));

  // recompute on form changes
  ['input','change','blur'].forEach(ev=>{
    els.name.addEventListener(ev, updateCart);
    els.phone.addEventListener(ev, updateCart);
    els.addr.addEventListener(ev, updateCart);
    els.district.addEventListener(ev, updateCart);
  });

  // LINE checkout
  els.lineBtn.addEventListener('click', ()=>{
    const msg = buildMessage();
    const id  = state.cfg.lineId;
    const url = 'https://line.me/R/oaMessage/' + encodeURIComponent(id) + '/?' +
                encodeURIComponent(msg).replace(/%0A/g,'%0A');
    const w = window.open(url,'_blank');
    if (!w){
      navigator.clipboard.writeText(msg).catch(()=>{});
      alert('Order text copied. Paste it into LINE chat.');
    }
  });

  // Email checkout
  els.mailBtn.addEventListener('click', ()=>{
    const subject = encodeURIComponent("Order — 5 O'CLOCK Tea");
    const body    = encodeURIComponent(buildMessage());
    const mailto  = `mailto:${state.cfg.email}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  });
}

boot();

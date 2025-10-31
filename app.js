
async function loadConfig(){ const r=await fetch('./data/products.json'); return r.json(); }
const state={config:null,cart:[],lastQuote:null};
const els={
  grid:document.getElementById('productGrid'),
  drawer:document.getElementById('cartDrawer'),
  open:document.getElementById('openCart'),
  close:document.getElementById('closeCart'),
  closeBtn:document.getElementById('closeCartBtn'),
  items:document.getElementById('cartItems'),
  count:document.getElementById('cartCount'),
  subtotal:document.getElementById('cartSubtotal'),
  shipping:document.getElementById('shippingCost'),
  total:document.getElementById('cartTotal'),
  checkout:document.getElementById('checkoutBtn'),
  addr:document.getElementById('address'),
  name:document.getElementById('custName'),
  phone:document.getElementById('custPhone')
};
function fmtTHB(v){ return 'THB '+Number(v).toLocaleString('en-US'); }

function haversineKm(a,b){ const R=6371,toRad=x=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng); const la1=toRad(a.lat), la2=toRad(b.lat); const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function estimateLocal(pickup,dropoff){ const km=haversineKm(pickup,dropoff); const base=35, perKm=9, minFee=45; const price=Math.max(minFee, Math.round(base+perKm*km)); const eta=Math.round(10+(km/25)*60); return {ok:true,priceTHB:price,km:km,etaMin:eta}; }
function parseLatLngFromText(t){ if(!t) return null; const m=String(t).match(/@(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/); if(m) return {lat:parseFloat(m[1]),lng:parseFloat(m[3])}; const m2=String(t).match(/(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/); if(m2) return {lat:parseFloat(m2[1]),lng:parseFloat(m2[3])}; return null; }

function renderProducts(){ const cfg=state.config; cfg.items.forEach(p=>{ const el=document.createElement('div'); el.className='card'; el.innerHTML=`
  <img src="${p.img}" alt="${p.name}">
  <h3>${p.name}</h3>
  <p>${p.desc}</p>
  <div class="row"><span class="small">Size</span>
    <select class="size">${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmtTHB(o.price)}</option>`).join('')}</select>
  </div>
  <div style="padding:12px">
    <button class="btn ${p.outOfStock?'btn-purple':'btn-primary'} add" data-id="${p.id}">${p.outOfStock?'Preorder':'Add to cart'}</button>
    ${p.outOfStock?'<span class="badge">ETA 7–10 days</span>':''}
  </div>`; els.grid.appendChild(el); }); }

function updateCart(){ els.items.innerHTML=''; let subtotal=0; state.cart.forEach((it,idx)=>{ if(it.id!=='delivery') subtotal+=it.price*it.qty; const row=document.createElement('div'); row.className='row'; row.innerHTML=`
    <img src="${it.img}" alt="">
    <div style="flex:1"><div style="font-weight:600">${it.name}${it.variant?(' — '+it.variant):''}${it.preorder?'<span class="badge">PREORDER</span>':''}</div>
    <div class="small">${fmtTHB(it.price)} × ${it.qty}</div></div>
    ${it.id==='delivery'?'':`<div><button data-act="dec" data-idx="${idx}">−</button><button data-act="inc" data-idx="${idx}">+</button><button data-act="del" data-idx="${idx}">✕</button></div>`}`; els.items.appendChild(row); });
  const coords=parseLatLngFromText(els.addr.value.trim()); state.lastQuote = coords? estimateLocal(state.config.pickup, coords) : null;
  const shipping = state.lastQuote? state.lastQuote.priceTHB : (subtotal>=state.config.freeShippingThreshold?0:70);
  const dIdx = state.cart.findIndex(x=>x.id==='delivery');
  if (shipping>0){ const it={id:'delivery',name:'Delivery',variant:'Local courier (estimate)',price:shipping,qty:1,img:'./images/delivery.png'}; if(dIdx>-1) state.cart[dIdx]=it; else state.cart.push(it); }
  else if(dIdx>-1){ state.cart.splice(dIdx,1); }
  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  els.subtotal.textContent=fmtTHB(subtotal); els.shipping.textContent=fmtTHB(shipping); els.total.textContent=fmtTHB(total);
  const items = state.cart.filter(i=>i.id!=='delivery').reduce((s,i)=>s+i.qty,0); els.count.textContent=items;
  els.checkout.disabled = !(items>0 && els.name.value.trim() && els.phone.value.trim() && els.addr.value.trim());
}

function buildOrderText(){ const lines=state.cart.filter(i=>i.id!=='delivery').map(i=>`• ${i.name}${i.variant?` (${i.variant})`:''}${i.preorder?' [PREORDER]':''} x${i.qty} — THB ${i.price}`).join('\n');
  const subtotal=state.cart.filter(i=>i.id!=='delivery').reduce((s,i)=>s+i.price*i.qty,0);
  const delivery=state.cart.find(i=>i.id==='delivery')?.price||0; const total=state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const dist = state.lastQuote? `\nDistance approx: ${state.lastQuote.km.toFixed(1)} km, ETA ~${state.lastQuote.etaMin} min` : '';
  return `Order from 5 o'clock Tea
${lines}

Subtotal: THB ${subtotal}
${delivery>0?`Delivery: THB ${delivery}\n`:''}Total: THB ${total}${dist}

Name: ${els.name.value.trim()}
Phone: ${els.phone.value.trim()}
Address: ${els.addr.value.trim()}`;}
function openLine(){ const msg=buildOrderText(); const id=state.config.lineId; const https='https://line.me/R/oaMessage/'+encodeURIComponent(id)+'/?'+encodeURIComponent(msg).replace(/%0A/g,'%0A'); const opened=window.open(https,'_blank'); if(!opened){ navigator.clipboard.writeText(msg).catch(()=>{}); alert('Order text copied. Paste it into LINE chat.'); window.open('https://line.me/R/ti/p/'+encodeURIComponent(id),'_blank'); } }

document.addEventListener('click',(e)=>{ const act=e.target.getAttribute('data-act'); if(act){ const idx=parseInt(e.target.getAttribute('data-idx'),10); if(act==='inc') state.cart[idx].qty+=1; if(act==='dec') state.cart[idx].qty=Math.max(1,state.cart[idx].qty-1); if(act==='del'){ if(state.cart[idx].id!=='delivery') state.cart.splice(idx,1);} updateCart(); return; }
  if(e.target.classList.contains('add')){ const card=e.target.closest('.card'); const sel=card.querySelector('.size'); const pid=e.target.getAttribute('data-id'); const p=state.config.items.find(x=>x.id===pid); const opt=p.options[parseInt(sel.value,10)]; const found=state.cart.find(i=>i.id===pid&&i.variant===opt.label); if(found) found.qty+=1; else state.cart.push({id:pid,name:p.name,variant:opt.label,price:opt.price,qty:1,img:p.img,preorder:!!p.outOfStock}); updateCart(); els.drawer.classList.add('open'); } });
['input','change','blur'].forEach(ev=> els.addr.addEventListener(ev, updateCart)); ['input','change','blur'].forEach(ev=> els.name.addEventListener(ev, updateCart)); ['input','change','blur'].forEach(ev=> els.phone.addEventListener(ev, updateCart));
els.open.addEventListener('click',()=>els.drawer.classList.add('open')); els.close.addEventListener('click',()=>els.drawer.classList.remove('open')); els.closeBtn.addEventListener('click',()=>els.drawer.classList.remove('open')); els.checkout.addEventListener('click',(e)=>{e.preventDefault(); openLine();});
loadConfig().then(cfg=>{ state.config=cfg; renderProducts(); updateCart(); });

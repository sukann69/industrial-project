/* StockMini - ตรรกะทั้งหมด (Vanilla JS + LocalStorage) */
const KEY = 'stockmini_v1';
const $ = id => document.getElementById(id);

// ---------- ข้อมูล ----------
let db = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.products) && Array.isArray(d.tx)) return d;
  } catch (e) {}
  return { products: [], tx: [] };
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

// ---------- ฟังก์ชันช่วย ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const dkey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dtxt = ts => { const d = new Date(ts); return dkey(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ST_TXT = { out: 'หมดสต็อก', low: 'สต็อกต่ำ', ok: 'ปกติ' };
// สถานะ: 0 = หมด, <= ขั้นต่ำ = ต่ำ, มากกว่านั้น = ปกติ
const status = p => p.qty === 0 ? 'out' : p.qty <= p.min ? 'low' : 'ok';
const tag = p => '<span class="tag ' + status(p) + '">' + ST_TXT[status(p)] + '</span>';
const emptyBox = (id, show, msg) => { $(id).innerHTML = show ? '<div class="empty">' + msg + '</div>' : ''; };
const refill = p => Math.max(p.target - p.qty, 0);
const isInt = v => /^\d+$/.test(String(v).trim());

let toastT;
function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 2500);
}

// ---------- การนำทาง ----------
function show(v) {
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  renderAll();
}
$('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.v); });

// ---------- Dashboard ----------
function barChart(el, groups) { // groups: [{label,in,out}]
  const max = Math.max(1, ...groups.map(g => Math.max(g.in, g.out)));
  el.innerHTML = '<div class="chart">' + groups.map(g =>
    '<div class="col"><div class="pair"><i class="in" style="height:' + g.in / max * 100 + '%" title="รับเข้า ' + g.in + '"></i><i class="out" style="height:' + g.out / max * 100 + '%" title="จ่ายออก ' + g.out + '"></i></div><small>' + esc(g.label) + '</small><small>+' + g.in + '/-' + g.out + '</small></div>'
  ).join('') + '</div><div class="legend">🟧 รับเข้า &nbsp; 🟨 จ่ายออก</div>';
}
function groupTx(keyFn) {
  const m = {};
  db.tx.forEach(t => { const k = keyFn(t.ts); m[k] = m[k] || { label: k, in: 0, out: 0 }; m[k][t.type] += t.qty; });
  return m;
}
function renderDash() {
  const P = db.products;
  $('d-items').textContent = fmt(P.length);
  $('d-qty').textContent = fmt(P.reduce((s, p) => s + p.qty, 0));
  $('d-val').textContent = fmt(P.reduce((s, p) => s + p.qty * p.price, 0));
  const low = P.filter(p => p.qty <= p.min);
  $('d-low').textContent = low.length;
  // กราฟ 7 วันล่าสุด
  const m = groupTx(dkey), days = [];
  for (let i = 6; i >= 0; i--) { const k = dkey(Date.now() - i * 864e5); days.push(m[k] || { label: k, in: 0, out: 0 }); }
  days.forEach(d => d.label = d.label.slice(5));
  if (!db.tx.length) $('d-chart').innerHTML = '<div class="empty">ยังไม่มีรายการรับเข้า/จ่ายออก ไปที่เมนู "รับ/จ่าย" เพื่อเริ่มบันทึก</div>';
  else barChart($('d-chart'), days);
  $('d-refill').innerHTML = low.length ? '<ul>' + low.map(p => '<li>' + esc(p.name) + ' เหลือ ' + p.qty + ' (ควรเติม ' + refill(p) + ')</li>').join('') + '</ul>'
    : '<div class="empty">ยังไม่มีสินค้าที่ต้องเติมสต็อก</div>';
}

// ---------- จัดการสินค้า ----------
function renderCats() {
  const sel = $('p-cat'), cur = sel.value;
  const cats = [...new Set(db.products.map(p => p.cat).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + cats.map(c => '<option>' + esc(c) + '</option>').join('');
  sel.value = cats.includes(cur) ? cur : '';
}
function renderProd() {
  renderCats();
  const q = $('p-search').value.trim().toLowerCase(), c = $('p-cat').value;
  const list = db.products.filter(p => (!c || p.cat === c) && (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)));
  $('p-body').innerHTML = list.map(p => '<tr><td>' + esc(p.code) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.cat || '-') + '</td><td class="num">' + fmt(p.price) + '</td><td class="num">' + fmt(p.qty) + '</td><td class="num">' + fmt(p.min) + '</td><td>' + tag(p) +
    '</td><td><button class="btn sm" data-act="edit" data-id="' + p.id + '">แก้ไข</button><button class="btn sm red" data-act="del" data-id="' + p.id + '">ลบ</button></td></tr>').join('');
  emptyBox('p-empty', !list.length, db.products.length ? 'ไม่พบสินค้าที่ตรงกับการค้นหา' : 'ยังไม่มีสินค้า กดปุ่ม "+ เพิ่มสินค้า" หรือโหลดข้อมูลตัวอย่างที่หน้าภาพรวม');
}
let editId = null;
function openForm(id) {
  editId = id; $('f-err').textContent = '';
  const p = db.products.find(x => x.id === id);
  $('m-title').textContent = p ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า';
  $('f-code').value = p ? p.code : ''; $('f-name').value = p ? p.name : ''; $('f-cat').value = p ? p.cat : '';
  $('f-price').value = p ? p.price : ''; $('f-qty').value = p ? p.qty : ''; $('f-min').value = p ? p.min : ''; $('f-target').value = p ? p.target : '';
  $('f-qty').disabled = !!p; // แก้ไขยอดคงเหลือผ่านรายการรับ/จ่ายเท่านั้น เพื่อให้ประวัติตรงกับยอด
  $('m-prod').hidden = false;
}
function saveProduct() {
  const code = $('f-code').value.trim(), name = $('f-name').value.trim(), cat = $('f-cat').value.trim();
  const priceS = $('f-price').value.trim(), qtyS = $('f-qty').value.trim(), minS = $('f-min').value.trim(), tgS = $('f-target').value.trim();
  const err = m => { $('f-err').textContent = m; };
  if (!code) return err('กรุณากรอกรหัสสินค้า');
  if (!name) return err('กรุณากรอกชื่อสินค้า');
  if (db.products.some(p => p.id !== editId && p.code.toLowerCase() === code.toLowerCase())) return err('รหัสสินค้านี้มีอยู่แล้ว');
  const price = Number(priceS);
  if (priceS === '' || !isFinite(price) || price < 0) return err('ราคาต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if (!editId && !isInt(qtyS)) return err('จำนวนเริ่มต้นต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
  if (!isInt(minS)) return err('จำนวนขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
  if (!isInt(tgS) || Number(tgS) < Number(minS)) return err('ระดับเป้าหมายต้องเป็นจำนวนเต็มและไม่น้อยกว่าจำนวนขั้นต่ำ');
  if (editId) {
    Object.assign(db.products.find(p => p.id === editId), { code, name, cat, price, min: Number(minS), target: Number(tgS) });
    db.tx.forEach(t => { if (t.pid === editId) { t.code = code; t.name = name; } });
    toast('แก้ไขสินค้าเรียบร้อย');
  } else {
    db.products.push({ id: uid(), code, name, cat, price, qty: Number(qtyS), min: Number(minS), target: Number(tgS) });
    toast('เพิ่มสินค้าเรียบร้อย');
  }
  save(); $('m-prod').hidden = true; renderAll();
}
let delId = null;
$('p-body').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'edit') openForm(b.dataset.id);
  if (b.dataset.act === 'del') { delId = b.dataset.id; const p = db.products.find(x => x.id === delId); $('c-msg').textContent = 'ต้องการลบ "' + p.name + '" ใช่หรือไม่? (ประวัติรายการเดิมจะยังคงอยู่)'; $('m-conf').hidden = false; }
});
$('c-yes').onclick = () => { db.products = db.products.filter(p => p.id !== delId); save(); $('m-conf').hidden = true; toast('ลบสินค้าเรียบร้อย'); renderAll(); };
$('c-no').onclick = () => $('m-conf').hidden = true;
$('btn-add').onclick = () => openForm(null);
$('f-cancel').onclick = () => $('m-prod').hidden = true;
$('f-save').onclick = saveProduct;
$('p-search').oninput = renderProd; $('p-cat').onchange = renderProd;

// ---------- รับเข้า / จ่ายออก ----------
function nowLocal() { const d = new Date(); return dkey(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function renderTx() {
  const sel = $('t-prod'), cur = sel.value, has = db.products.length > 0;
  sel.innerHTML = db.products.map(p => '<option value="' + p.id + '">' + esc(p.code) + ' - ' + esc(p.name) + ' (เหลือ ' + p.qty + ')</option>').join('');
  if (db.products.some(p => p.id === cur)) sel.value = cur;
  $('t-form').hidden = !has;
  $('t-nodata').textContent = has ? '' : 'ยังไม่มีสินค้า กรุณาเพิ่มสินค้าก่อนทำรายการ';
  if (!$('t-time').value) $('t-time').value = nowLocal();
  const list = [...db.tx].sort((a, b) => b.ts - a.ts).slice(0, 30);
  $('t-body').innerHTML = list.map(t => '<tr><td>' + dtxt(t.ts) + '</td><td>' + esc(t.name) + '</td><td>' + (t.type === 'in' ? 'รับเข้า' : 'จ่ายออก') + '</td><td class="num">' + t.qty + '</td><td>' + esc(t.note || '-') + '</td></tr>').join('');
  emptyBox('t-empty', !list.length, 'ยังไม่มีประวัติการรับเข้า/จ่ายออก');
}
$('t-save').onclick = () => {
  const p = db.products.find(x => x.id === $('t-prod').value);
  if (!p) return toast('กรุณาเลือกสินค้า', true);
  const qs = $('t-qty').value.trim();
  if (!isInt(qs) || Number(qs) < 1) return toast('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป', true);
  const qty = Number(qs), type = $('t-type').value;
  const ts = new Date($('t-time').value).getTime();
  if (!isFinite(ts)) return toast('วันที่และเวลาไม่ถูกต้อง', true);
  if (type === 'out' && qty > p.qty) return toast('สินค้าไม่พอ! คงเหลือเพียง ' + p.qty, true);
  p.qty += type === 'in' ? qty : -qty; // คงเหลือใหม่ = เดิม ± จำนวน
  db.tx.push({ id: uid(), pid: p.id, code: p.code, name: p.name, type, qty, ts, note: $('t-note').value.trim() });
  save(); $('t-qty').value = ''; $('t-note').value = ''; $('t-time').value = nowLocal();
  toast(type === 'in' ? 'บันทึกการรับเข้าเรียบร้อย' : 'บันทึกการจ่ายออกเรียบร้อย'); renderAll();
};

// ---------- สต็อกต่ำ ----------
function renderLow() {
  const list = db.products.filter(p => p.qty <= p.min);
  $('l-body').innerHTML = list.map(p => '<tr><td>' + esc(p.name) + '</td><td class="num">' + p.qty + '</td><td class="num">' + p.min + '</td><td class="num">' + p.target + '</td><td class="num"><b>' + refill(p) + '</b></td><td>' + tag(p) + '</td></tr>').join('');
  emptyBox('l-empty', !list.length, db.products.length ? '✅ ตอนนี้ไม่มีสินค้าที่ต้องสั่งซื้อเพิ่ม' : 'ยังไม่มีสินค้าในระบบ');
}

// ---------- วิเคราะห์ ----------
function renderAna() {
  const mode = $('a-mode').value, keyFn = ts => mode === 'day' ? dkey(ts) : dkey(ts).slice(0, 7);
  const m = groupTx(keyFn), groups = Object.keys(m).sort().map(k => m[k]);
  const tin = db.tx.filter(t => t.type === 'in').reduce((s, t) => s + t.qty, 0), tout = db.tx.filter(t => t.type === 'out').reduce((s, t) => s + t.qty, 0);
  $('a-in').textContent = fmt(tin); $('a-out').textContent = fmt(tout);
  if (!groups.length) { $('a-chart').innerHTML = '<div class="empty">ยังไม่มีข้อมูลรายการ จึงยังไม่สามารถแสดงกราฟได้</div>'; $('a-trend').textContent = ''; }
  else {
    barChart($('a-chart'), groups.slice(-12).map(g => ({ ...g, label: mode === 'day' ? g.label.slice(5) : g.label })));
    // ต้องมีอย่างน้อย 3 ช่วงเวลา จึงจะสรุปแนวโน้มได้
    if (groups.length < 3) $('a-trend').textContent = 'ข้อมูลไม่เพียงพอ (มี ' + groups.length + ' ช่วงเวลา ต้องการอย่างน้อย 3) จึงไม่สามารถสรุปแนวโน้มได้';
    else {
      const last = groups[groups.length - 1].out, prev = groups.slice(0, -1), avg = prev.reduce((s, g) => s + g.out, 0) / prev.length;
      $('a-trend').textContent = 'จ่ายออกช่วงล่าสุด ' + last + ' หน่วย เทียบค่าเฉลี่ยช่วงก่อนหน้า ' + fmt(avg) + ' หน่วย (เป็นเพียงข้อมูลเปรียบเทียบ ไม่ใช่การพยากรณ์)';
    }
  }
  const sum = {};
  db.tx.filter(t => t.type === 'out').forEach(t => { sum[t.pid] = sum[t.pid] || { name: t.name, qty: 0 }; sum[t.pid].qty += t.qty; });
  const rank = Object.values(sum).sort((a, b) => b.qty - a.qty).slice(0, 10);
  $('a-rank').innerHTML = rank.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td class="num">' + fmt(r.qty) + '</td></tr>').join('');
  emptyBox('a-empty', !rank.length, 'ยังไม่มีรายการจ่ายออก จึงไม่สามารถจัดอันดับได้');
}
$('a-mode').onchange = renderAna;

// ---------- รายงาน ----------
function txRange() {
  const f = $('r-from').value, t = $('r-to').value;
  return db.tx.filter(x => { const k = dkey(x.ts); return (!f || k >= f) && (!t || k <= t); }).sort((a, b) => b.ts - a.ts);
}
function renderRep() {
  $('r-pbody').innerHTML = db.products.map(p => '<tr><td>' + esc(p.code) + '</td><td>' + esc(p.name) + '</td><td class="num">' + fmt(p.qty) + '</td><td class="num">' + fmt(p.price) + '</td><td class="num">' + fmt(p.qty * p.price) + '</td><td>' + tag(p) + '</td></tr>').join('');
  emptyBox('r-pempty', !db.products.length, 'ยังไม่มีสินค้าในรายงาน');
  const list = txRange();
  $('r-range').textContent = ($('r-from').value || $('r-to').value) ? '(' + ($('r-from').value || 'เริ่มต้น') + ' ถึง ' + ($('r-to').value || 'ปัจจุบัน') + ')' : '(ทั้งหมด)';
  $('r-tbody').innerHTML = list.map(t => '<tr><td>' + dtxt(t.ts) + '</td><td>' + esc(t.code) + '</td><td>' + esc(t.name) + '</td><td>' + (t.type === 'in' ? 'รับเข้า' : 'จ่ายออก') + '</td><td class="num">' + t.qty + '</td><td>' + esc(t.note || '-') + '</td></tr>').join('');
  emptyBox('r-tempty', !list.length, 'ไม่มีรายการในช่วงวันที่ที่เลือก');
}
$('r-from').onchange = $('r-to').onchange = renderRep;
function csv(rows, name) {
  const body = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' })); // \ufeff ให้ Excel อ่านภาษาไทยได้
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('ส่งออกไฟล์ ' + name + ' แล้ว');
}
$('r-csv-p').onclick = () => {
  if (!db.products.length) return toast('ไม่มีข้อมูลสินค้าให้ส่งออก', true);
  csv([['รหัส', 'ชื่อ', 'หมวดหมู่', 'ราคาต่อหน่วย', 'คงเหลือ', 'ขั้นต่ำ', 'เป้าหมาย', 'มูลค่า', 'สถานะ']].concat(db.products.map(p => [p.code, p.name, p.cat, p.price, p.qty, p.min, p.target, p.qty * p.price, ST_TXT[status(p)]])), 'stockmini_products.csv');
};
$('r-csv-t').onclick = () => {
  const l = txRange(); if (!l.length) return toast('ไม่มีรายการให้ส่งออก', true);
  csv([['เวลา', 'รหัส', 'สินค้า', 'ประเภท', 'จำนวน', 'หมายเหตุ']].concat(l.map(t => [dtxt(t.ts), t.code, t.name, t.type === 'in' ? 'รับเข้า' : 'จ่ายออก', t.qty, t.note || ''])), 'stockmini_history.csv');
};
$('r-print').onclick = () => window.print();

// ---------- ข้อมูลตัวอย่าง ----------
$('btn-sample').onclick = () => {
  const S = [['S001', 'น้ำดื่ม', 'เครื่องดื่ม', 7, 30, 10, 40], ['S002', 'ขนม', 'ขนม', 10, 15, 5, 25], ['S003', 'สมุด', 'เครื่องเขียน', 20, 8, 5, 20]];
  let n = 0;
  S.forEach(s => { if (!db.products.some(p => p.code === s[0])) { db.products.push({ id: uid(), sample: true, code: s[0], name: s[1], cat: s[2], price: s[3], qty: s[4], min: s[5], target: s[6] }); n++; } });
  save(); toast(n ? 'โหลดข้อมูลตัวอย่างแล้ว' : 'มีข้อมูลตัวอย่างอยู่แล้ว', !n); renderAll();
};
$('btn-clear-sample').onclick = () => {
  const ids = db.products.filter(p => p.sample).map(p => p.id);
  if (!ids.length) return toast('ไม่มีข้อมูลตัวอย่างให้ลบ', true);
  db.products = db.products.filter(p => !p.sample); db.tx = db.tx.filter(t => !ids.includes(t.pid));
  save(); toast('ลบข้อมูลตัวอย่างแล้ว'); renderAll();
};

// ---------- เริ่มทำงาน ----------
function renderAll() { renderDash(); renderProd(); renderTx(); renderLow(); renderAna(); renderRep(); }
renderAll();

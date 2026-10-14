// โค้ดที่ทุกหน้าใช้ร่วมกัน: ตัวช่วย, เรียก API, หัวเว็บ + เมนู
const SHOP = { lat: 16.2469, lng: 103.2522 }; // ตรงกับ CONFIG.shop ใน backend
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " ฿";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// ที่อยู่ backend: ใส่ ?api=http://host:port ต่อท้าย URL เพื่อกำหนดเอง (จำไว้ในแท็บนั้น)
// ไม่ระบุ: เปิดผ่านพอร์ต 3000 หรือโดเมนจริง (เช่น Render) ใช้ origin เดียวกัน ส่วนกรณีอื่น (เปิดเป็นไฟล์ / Live Server) ใช้ http://127.0.0.1:3000
const API = (() => {
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q) sessionStorage.setItem("api", q.replace(/\/$/, ""));
    const saved = sessionStorage.getItem("api");
    if (saved) return saved;
  } catch { }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  return location.protocol.startsWith("http") && (location.port === "3000" || !local) ? location.origin : "http://127.0.0.1:3000"; // ใช้ 127.0.0.1 แทน localhost กัน localhost ไปชนโปรแกรมอื่นที่จองพอร์ต 3000 ฝั่ง IPv6 (::1)
})();
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function toast(t) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.style.display = "block";
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.style.display = "none"), 3500);
}

async function call(path, method = "GET", body) {
  const r = await fetch(API + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || j.error || "เกิดข้อผิดพลาด " + r.status);
  return j;
}

const PAGES = [
  ["home", "home.html", "🏠 หน้าหลัก"],
  ["customers", "customers.html", "👥 ลูกค้า"],
  ["orders", "orders.html", "📦 ออเดอร์"],
  ["gps", "gps.html", "🗺️ จัดเส้นทางจัดส่ง"],
  ["rider", "rider.html", "🛵 หน้าจอไรเดอร์"],
];

// วาดหัวเว็บ + เมนูลงใน <div id="top">; withDate = มีช่องเลือกวันที่ (เปลี่ยนวันแล้วเรียก onDateChange)
function renderTop(active, withDate) {
  $("top").innerHTML = `
    <header>
      <h1>🛵 เส้นทางอร่อย <small style="font-weight:400;font-size:13px;opacity:.9">· ระบบจัดเส้นทางและแบ่งงานไรเดอร์</small></h1>
      ${withDate ? `<label>วันที่ <input id="date" type="date"></label>` : ""}
      ${Auth.session() ? `<span style="font-size:13px;opacity:.9">${Auth.session().role === "owner" ? "🏪 เจ้าของร้าน" : "🛵 " + esc(Auth.session().name || "ไรเดอร์")}</span><button class="back" onclick="Auth.logout()">ออกจากระบบ</button>` : ""}
    </header>
    ${active === "rider" ? "" : `<nav>${PAGES.map(([k, href, label]) => `<a href="${href}" class="${k === active ? "on" : ""}">${label}</a>`).join("")}</nav>`}`;
  if (withDate) {
    let d = today();
    try { d = sessionStorage.getItem("date") || d; } catch { }
    $("date").value = d;
    $("date").onchange = () => {
      try { sessionStorage.setItem("date", $("date").value); } catch { }
      if (window.onDateChange) onDateChange();
    };
  }
}

function leafletMap(el, center, zoom) {
  const m = L.map(el).setView(center, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
  return m;
}
const shopIcon = () => L.divIcon({ className: "", html: `<div class="pin" style="background:#222;width:30px;height:30px;font-size:16px">🏪</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });

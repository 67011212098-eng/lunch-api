// ระบบล็อกอินฝั่งหน้าเว็บ แบ่งบทบาท: owner (เจ้าของร้าน) / rider (ไรเดอร์)
// ใส่ใน <head> ของแต่ละหน้า: <script src="auth.js" data-role="owner"></script>
//   data-role="owner" = เฉพาะเจ้าของร้าน, data-role="any" = ล็อกอินแล้วเป็นใครก็ได้, ไม่ใส่ = ไม่ตรวจ (หน้าล็อกอิน)
(function () {
  const KEY = "auth", TTL = 12 * 60 * 60 * 1000; // อยู่ในระบบ 12 ชั่วโมง
  const get = () => {
    try { const a = JSON.parse(localStorage.getItem(KEY)); if (a && a.exp > Date.now()) return a; } catch {}
    return null;
  };
  window.Auth = {
    session: get,
    login(role, extra) { localStorage.setItem(KEY, JSON.stringify({ role, ...extra, exp: Date.now() + TTL })); },
    logout() { try { localStorage.removeItem(KEY); } catch {} location.replace("login.html"); },
    homeOf: (a) => (a && a.role === "owner" ? "home.html" : "rider.html"),
  };

  const need = document.currentScript && document.currentScript.dataset.role;
  if (!need) return;
  const a = get();
  const go = (url) => { document.documentElement.style.display = "none"; location.replace(url); };
  if (!a) go("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
  else if (need === "owner" && a.role !== "owner") go("rider.html"); // ไรเดอร์เข้าหน้าเจ้าของร้านไม่ได้
})();

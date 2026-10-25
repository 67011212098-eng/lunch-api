declare const L: any; // โหลดจาก CDN ใน index.html

// ตำแหน่งร้าน (ตรงกับ CONFIG.shop ใน services/optimizer.ts ที่ backend)
export const SHOP = { lat: 16.2469, lng: 103.2522 };

// หมุดวงกลมบนแผนที่ (สีของไรเดอร์มาจาก backend ตอนรันจึงใส่เป็น style แทนคลาส)
const PIN = 'rounded-full text-white font-bold flex items-center justify-center border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,.5)]';
export const SHOP_PIN = `<div class="${PIN} w-[30px] h-[30px] text-base bg-ink">🏪</div>`;
export const stopPin = (color: string, n: number) => `<div class="${PIN} w-6 h-6 text-xs" style="background:${color}">${n}</div>`;

const KEY = 'mapBase';
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const SAT_ATTR = 'ภาพดาวเทียม © Esri, Maxar, Earthstar Geographics';

// ชั้นแผนที่พื้นหลัง: แผนที่ถนน / ภาพดาวเทียม / ดาวเทียม + ชื่อสถานที่ พร้อมตัวเลือกมุมขวาบน (จำแบบที่เลือกไว้ในเครื่อง)
export function addBaseLayers(map: any) {
  const sat = () => L.tileLayer(ESRI + '/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: SAT_ATTR });
  const bases: Record<string, any> = {
    'แผนที่ถนน': L.tileLayer(OSM, { maxZoom: 19, attribution: '© OpenStreetMap' }),
    'ภาพดาวเทียม': sat(),
    'ดาวเทียม + ชื่อสถานที่': L.layerGroup([
      sat(),
      L.tileLayer(ESRI + '/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }),
    ]),
  };
  let saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch {}
  (bases[saved] ?? bases['แผนที่ถนน']).addTo(map);
  L.control.layers(bases, undefined, { collapsed: false }).addTo(map);
  map.on('baselayerchange', (e: any) => { try { localStorage.setItem(KEY, e.name); } catch {} });
}

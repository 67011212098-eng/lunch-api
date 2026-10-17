declare const L: any; // โหลดจาก CDN ใน index.html

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

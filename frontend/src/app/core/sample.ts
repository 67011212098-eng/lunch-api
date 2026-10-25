// สุ่มลูกค้าตัวอย่างสำหรับทดสอบ: ชื่อ เบอร์ ที่อยู่ และพิกัดรอบร้านในรัศมีราว 3 กม.
const FIRST = ['สมชาย', 'สมหญิง', 'วิชัย', 'มาลี', 'ประเสริฐ', 'สุดา', 'อนันต์', 'กัญญา', 'ธนพล', 'พิมพ์ชนก',
  'ณัฐวุฒิ', 'ศิริพร', 'กิตติ', 'อรุณี', 'ปิยะ', 'จันทร์เพ็ญ', 'เอกชัย', 'รัตนา', 'ภานุ', 'นภัสสร'];
const LAST = ['ใจดี', 'ศรีสุข', 'บุญมา', 'แสงทอง', 'พรหมมา', 'ทองดี', 'สายสุด', 'คำมูล', 'ภูมิใจ', 'วงศ์ไทย',
  'ชัยมงคล', 'มีสุข', 'ศรีวงศ์', 'นาคสวัสดิ์', 'โพธิ์ทอง'];
const PLACE = ['บ้านขามเรียง', 'บ้านดอนหน่อง', 'บ้านดอนเวียงจันทน์', 'บ้านโนนแสบง', 'หอพักหน้ามหาวิทยาลัย'];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('');

export function randomCustomer(center: { lat: number; lng: number }) {
  return {
    firstname: pick(FIRST),
    lastname: pick(LAST),
    phone: pick(['06', '08', '09']) + digits(8),
    address: `${int(1, 250)} หมู่ ${int(1, 15)} ${pick(PLACE)} ต.ขามเรียง อ.กันทรวิชัย จ.มหาสารคาม`,
    lat: +(center.lat + (Math.random() - 0.5) * 0.05).toFixed(6),
    lng: +(center.lng + (Math.random() - 0.5) * 0.05).toFixed(6),
  };
}

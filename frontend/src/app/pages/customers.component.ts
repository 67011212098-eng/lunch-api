import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { concatMap, finalize, from, toArray } from 'rxjs';
import { ApiService, Customer, errMsg } from '../core/api';
import { ConfirmService } from '../core/confirm';
import { SHOP, SHOP_PIN, addBaseLayers } from '../core/map';
import { randomCustomer } from '../core/sample';

declare const L: any; // โหลดจาก CDN ใน index.html

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// ช่อง type="number" ที่ลบจนว่างจะได้ null ส่วนฟอร์มเปล่าเป็น ''
const blank = (v: unknown) => v === '' || v == null;

type Coord = string | number | null;
type Form = { firstname: string; lastname: string; phone: string; address: string; lat: Coord; lng: Coord };
const BLANK: Form = { firstname: '', lastname: '', phone: '', address: '', lat: '', lng: '' };

@Component({
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <main class="max-w-[1100px] mx-auto p-[18px] grid grid-cols-1 gap-[18px]">
      <section class="card">
        <h2 class="text-[17px] font-bold mb-3">{{ editingId ? 'แก้ไขลูกค้า #' + editingId : 'เพิ่มลูกค้าใหม่' }}
          <span class="text-sm text-mute">{{ nearby ? '(ในรัศมี ' + nearby.radius + ' กม. พบ ' + list.length + ' คน)' : '(' + list.length + ' คน)' }}</span></h2>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 mb-2.5">
          <input class="field w-full" [(ngModel)]="f.firstname" placeholder="ชื่อ">
          <input class="field w-full" [(ngModel)]="f.lastname" placeholder="นามสกุล">
          <input class="field w-full" [(ngModel)]="f.phone" placeholder="เบอร์โทร">
          <input class="field w-full" [(ngModel)]="f.address" placeholder="ที่อยู่">
          <input class="field w-full" [(ngModel)]="f.lat" type="number" step="any" placeholder="ละติจูด (lat)">
          <input class="field w-full" [(ngModel)]="f.lng" type="number" step="any" placeholder="ลองจิจูด (lng)">
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button class="btn" (click)="save()">{{ editingId ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า' }}</button>
          <button class="btn-sec" (click)="sample()">🎲 สุ่มตัวอย่างลงฟอร์ม</button>
          <button class="btn-sec" (click)="reset()">ล้างฟอร์ม</button>
          <input class="field" [(ngModel)]="search" (ngModelChange)="load()" placeholder="ค้นหาชื่อลูกค้า…">
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button class="btn-sec" (click)="nearbySearch()">📍 หาลูกค้าใกล้พิกัดที่เลือก</button>
          <input class="field w-[90px]" type="number" min="0.1" step="0.1" [(ngModel)]="radius"><span>กม.</span>
          @if (nearby) {
            <button class="btn-sec" (click)="clearNearby()">แสดงลูกค้าทั้งหมด</button>
          }
          <span class="text-sm text-mute">ใช้พิกัดจากช่องละติจูด/ลองจิจูด (คลิกบนแผนที่) ถ้าเว้นว่างใช้ตำแหน่งร้าน</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <span class="text-sm text-mute">ข้อมูลทดสอบ:</span>
          <label class="text-sm text-mute">จำนวน <input class="field w-[70px]" type="number" min="1" max="50" [(ngModel)]="randCount"> คน</label>
          <button class="btn-sec" (click)="addRandom()" [disabled]="busy">🎲 สุ่มเพิ่มลูกค้า</button>
          <button class="btn-sec" (click)="deleteAll()" [disabled]="busy">🗑️ ลบลูกค้าทั้งหมด</button>
        </div>
        <p class="text-sm text-mute my-3.5">💡 คลิกบนแผนที่เพื่อกำหนดพิกัดบ้านลูกค้า</p>
        <div #cmap class="h-[380px] rounded-[10px] mt-3"></div>
      </section>

      <section class="card">
        <div class="max-h-[360px] overflow-auto">
          <table class="w-full text-sm">
            <thead><tr><th>#</th><th>ชื่อ</th><th>เบอร์โทร</th><th>ที่อยู่</th><th>พิกัด</th><th></th></tr></thead>
            <tbody>
              @for (c of list; track c.id) {
                <tr>
                  <td>{{ c.id }}</td>
                  <td>{{ c.firstname }} {{ c.lastname }}</td>
                  <td>{{ c.phone }}</td>
                  <td>{{ c.address }}</td>
                  <td>{{ c.lat | number: '1.4-4' }}, {{ c.lng | number: '1.4-4' }}{{ c.distance_km !== undefined ? ' · ห่าง ' + c.distance_km + ' กม.' : '' }}</td>
                  <td>
                    <button class="btn-sec" (click)="focusOn(c)">📍 ดูบนแผนที่</button>
                    <button class="btn-sec" (click)="edit(c)">แก้ไข</button>
                    <button class="btn-sec" (click)="del(c)">🗑️ ลบ</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-mute">{{ nearby ? 'ไม่มีลูกค้าในรัศมีนี้' : 'ไม่พบลูกค้า' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `,
})
export class CustomersComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cmap', { static: true }) cmapEl!: ElementRef<HTMLElement>;
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  list: Customer[] = [];
  search = '';
  editingId: number | null = null;
  f: Form = { ...BLANK };
  randCount = 10;
  busy = false;
  radius: number | null = 1;
  nearby: { lat: number; lng: number; radius: number } | null = null;
  private urlFilter = ''; // ?firstname=&lastname= จากลิงก์ ใช้ตอนเปิดหน้าครั้งแรกเท่านั้น

  private map: any;
  private layer: any;
  private pick: any;

  // เปิดจากลิงก์ตามคู่มือได้: /customer?name= · ?firstname=&lastname= · /customer/nearby?lat=&lng=&radius= · /customer/:id
  ngOnInit() {
    const s = this.route.snapshot, q = s.queryParamMap;
    if (s.routeConfig?.path === 'customer/nearby') {
      this.f.lat = q.get('lat') ?? '';
      this.f.lng = q.get('lng') ?? '';
      if (q.get('radius')) this.radius = Number(q.get('radius'));
      this.nearbySearch();
      return;
    }
    if (q.get('name')) this.search = q.get('name')!;
    else if (q.get('firstname') || q.get('lastname')) {
      this.urlFilter = 'firstname=' + encodeURIComponent(q.get('firstname') || '') + '&lastname=' + encodeURIComponent(q.get('lastname') || '');
    }
    const id = Number(s.paramMap.get('id'));
    this.load(() => {
      if (!id) return;
      const c = this.list.find((x) => x.id === id);
      if (c) { this.edit(c); this.focusOn(c); } else this.api.say('ไม่พบลูกค้า id ' + id);
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.cmapEl.nativeElement).setView([SHOP.lat, SHOP.lng], 13);
    addBaseLayers(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    // คลิกบนแผนที่ → ใส่ละติจูด/ลองจิจูดลงฟอร์มอัตโนมัติ
    this.map.on('click', (e: any) => {
      this.f.lat = e.latlng.lat.toFixed(6);
      this.f.lng = e.latlng.lng.toFixed(6);
      this.showPick(e.latlng.lat, e.latlng.lng);
    });
    this.drawMarkers();
  }

  ngOnDestroy() { this.map?.remove(); }

  load(after?: () => void) {
    const q = this.search.trim();
    if (q && this.nearby) this.dropNearby(); // พิมพ์ค้นชื่อ = เลิกค้นในรัศมี
    const byUrl = !q && !this.nearby ? this.urlFilter : '';
    this.urlFilter = '';
    const n = this.nearby;
    const path = n
      ? `/customer/nearby?lat=${n.lat}&lng=${n.lng}&radius=${n.radius}`
      : '/customer' + (q ? '?name=' + encodeURIComponent(q) : byUrl ? '?' + byUrl : '');
    this.api.get<Customer[]>(path).subscribe({
      next: (r) => { this.list = r; this.drawMarkers(); after?.(); },
      error: (e) => this.api.say('โหลดลูกค้าไม่ได้: ' + errMsg(e)),
    });
  }

  // หาลูกค้าในรัศมีรอบพิกัดในฟอร์ม (คลิกบนแผนที่) ถ้าเว้นว่างทั้งสองช่องใช้ตำแหน่งร้าน
  nearbySearch() {
    const empty = blank(this.f.lat) && blank(this.f.lng);
    const lat = empty ? SHOP.lat : Number(this.f.lat), lng = empty ? SHOP.lng : Number(this.f.lng), radius = Number(this.radius);
    if (isNaN(lat) || isNaN(lng) || !(radius > 0)) { this.api.say('พิกัดและรัศมีต้องเป็นตัวเลข (รัศมีมากกว่า 0)'); return; }
    this.nearby = { lat, lng, radius };
    this.location.replaceState('/customer/nearby', `lat=${lat}&lng=${lng}&radius=${radius}`);
    this.search = '';
    this.load();
  }

  clearNearby() { this.dropNearby(); this.load(); }

  private dropNearby() {
    this.nearby = null;
    this.location.replaceState('/customer');
  }

  private showPick(lat: number, lng: number) {
    this.pick?.remove();
    this.pick = L.marker([lat, lng]).addTo(this.map).bindTooltip('พิกัดที่เลือก').openTooltip();
  }

  private drawMarkers() {
    if (!this.map) return;
    this.layer.clearLayers();
    L.marker([SHOP.lat, SHOP.lng], { icon: L.divIcon({ className: '', html: SHOP_PIN, iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindTooltip('ร้าน').addTo(this.layer);
    this.list.forEach((c) =>
      L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0e9384', fillOpacity: 1 })
        .bindPopup(`<b>${esc(c.firstname)} ${esc(c.lastname)}</b><br>${esc(c.phone)}<br>${esc(c.address)}`)
        .addTo(this.layer));
    if (this.nearby) {
      const n = this.nearby;
      const ring = L.circle([n.lat, n.lng], { radius: n.radius * 1000, color: '#e03131', weight: 2, fillOpacity: 0.05 }).addTo(this.layer);
      this.map.fitBounds(ring.getBounds(), { padding: [20, 20] });
    } else if (this.list.length) {
      this.map.fitBounds([[SHOP.lat, SHOP.lng], ...this.list.map((c) => [c.lat, c.lng])], { padding: [30, 30] });
    }
  }

  focusOn(c: Customer) {
    this.map.setView([c.lat, c.lng], 16);
    L.popup().setLatLng([c.lat, c.lng])
      .setContent(`<b>${esc(c.firstname)} ${esc(c.lastname)}</b><br>${esc(c.address)}`)
      .openOn(this.map);
    this.cmapEl.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  save() {
    const f = this.f, lat = Number(f.lat), lng = Number(f.lng);
    if (!f.firstname.trim() || !f.lastname.trim() || !f.phone.trim() || blank(f.lat) || blank(f.lng) || isNaN(lat) || isNaN(lng)) {
      this.api.say('กรอกชื่อ นามสกุล เบอร์ และพิกัด (คลิกบนแผนที่) ให้ครบ');
      return;
    }
    const body = { firstname: f.firstname.trim(), lastname: f.lastname.trim(), phone: f.phone.trim(), address: f.address.trim(), lat, lng };
    const req = this.editingId
      ? this.api.send('/customer/' + this.editingId, 'PUT', body)
      : this.api.send('/customer', 'POST', body);
    req.subscribe({
      next: () => { this.api.say(this.editingId ? 'แก้ไขลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว'); this.reset(); this.load(); },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  edit(c: Customer) {
    this.editingId = c.id;
    this.f = { firstname: c.firstname, lastname: c.lastname, phone: c.phone, address: c.address, lat: String(c.lat), lng: String(c.lng) };
    this.showPick(c.lat, c.lng);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // สุ่มลูกค้าตัวอย่างลงฟอร์ม ตรวจ/แก้ได้ก่อนกด "เพิ่มลูกค้า"
  sample() {
    const c = randomCustomer(SHOP);
    this.editingId = null;
    this.f = { ...c, lat: String(c.lat), lng: String(c.lng) };
    this.showPick(c.lat, c.lng);
    this.map.setView([c.lat, c.lng], 15);
  }

  // เพิ่มลูกค้าสุ่มทีละคนตามจำนวนที่กรอก (1–50)
  addRandom() {
    const n = Math.min(Math.max(Math.round(Number(this.randCount)) || 10, 1), 50);
    this.busy = true;
    from(Array.from({ length: n }, () => randomCustomer(SHOP)))
      .pipe(concatMap((c) => this.api.send('/customer', 'POST', c)), toArray(), finalize(() => (this.busy = false)))
      .subscribe({
        next: (r) => { this.api.say(`เพิ่มลูกค้าสุ่มแล้ว ${r.length} คน`); this.load(); },
        error: (e) => { this.api.say(errMsg(e)); this.load(); },
      });
  }

  // ลบลูกค้าทุกคนพร้อมออเดอร์ของแต่ละคน (backend ไม่มี API ลบทีเดียว จึงลบทีละคนด้วย ?force=true)
  deleteAll() {
    this.api.get<Customer[]>('/customer').subscribe({
      next: async (all) => {
        if (!all.length) { this.api.say('ไม่มีลูกค้าให้ลบ'); return; }
        if (!(await this.confirm.ask(`ลบลูกค้าทั้งหมด ${all.length} คน พร้อมออเดอร์ของทุกคน? ลบแล้วกู้คืนไม่ได้`))) return;
        this.busy = true;
        from(all)
          .pipe(concatMap((c) => this.api.send('/customer/' + c.id + '?force=true', 'DELETE')), toArray(), finalize(() => (this.busy = false)))
          .subscribe({
            next: (r) => { this.api.say(`ลบลูกค้าแล้ว ${r.length} คน`); this.reset(); this.load(); },
            error: (e) => { this.api.say(errMsg(e)); this.load(); },
          });
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  reset() {
    this.editingId = null;
    this.f = { ...BLANK };
    this.pick?.remove();
    this.pick = null;
  }

  async del(c: Customer) {
    if (!(await this.confirm.ask(`ลบลูกค้า ${c.firstname} ${c.lastname}?`))) return;
    const done = () => { this.api.say('ลบลูกค้าแล้ว'); if (this.editingId === c.id) this.reset(); this.load(); };
    this.api.send('/customer/' + c.id, 'DELETE').subscribe({
      next: done,
      error: async (e) => {
        const n = (/has (\d+) order/.exec(errMsg(e)) || [])[1];
        if (!n) { this.api.say(errMsg(e)); return; }
        if (!(await this.confirm.ask(`ลูกค้าคนนี้มี ${n} ออเดอร์อยู่ ลบออเดอร์ของเขาไปพร้อมกันเลยไหม?`))) return;
        this.api.send('/customer/' + c.id + '?force=true', 'DELETE').subscribe({
          next: done,
          error: (e2) => this.api.say(errMsg(e2)),
        });
      },
    });
  }
}

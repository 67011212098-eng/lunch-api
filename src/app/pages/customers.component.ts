import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { concatMap, finalize, from, toArray } from 'rxjs';
import { ApiService, Customer, errMsg } from '../core/api';
import { ConfirmService } from '../core/confirm';
import { addBaseLayers } from '../core/map';
import { randomCustomer } from '../core/sample';

declare const L: any; // โหลดจาก CDN ใน index.html

const SHOP = { lat: 16.2469, lng: 103.2522 };
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Form = { firstname: string; lastname: string; phone: string; address: string; lat: string; lng: string };
const BLANK: Form = { firstname: '', lastname: '', phone: '', address: '', lat: '', lng: '' };

@Component({
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <main>
      <section class="card">
        <h2>{{ editingId ? 'แก้ไขลูกค้า #' + editingId : 'เพิ่มลูกค้าใหม่' }} <span class="msg">({{ list.length }} คน)</span></h2>
        <div class="form">
          <input [(ngModel)]="f.firstname" placeholder="ชื่อ">
          <input [(ngModel)]="f.lastname" placeholder="นามสกุล">
          <input [(ngModel)]="f.phone" placeholder="เบอร์โทร">
          <input [(ngModel)]="f.address" placeholder="ที่อยู่">
          <input [(ngModel)]="f.lat" type="number" step="any" placeholder="ละติจูด (lat)">
          <input [(ngModel)]="f.lng" type="number" step="any" placeholder="ลองจิจูด (lng)">
        </div>
        <div class="row">
          <button (click)="save()">{{ editingId ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า' }}</button>
          <button class="sec" (click)="sample()">🎲 สุ่มตัวอย่างลงฟอร์ม</button>
          <button class="sec" (click)="reset()">ล้างฟอร์ม</button>
          <input [(ngModel)]="search" (ngModelChange)="load()" placeholder="ค้นหาชื่อลูกค้า…">
        </div>
        <div class="row">
          <span class="msg">ข้อมูลทดสอบ:</span>
          <label class="msg">จำนวน <input type="number" min="1" max="50" [(ngModel)]="randCount" style="width:70px"> คน</label>
          <button class="sec" (click)="addRandom()" [disabled]="busy">🎲 สุ่มเพิ่มลูกค้า</button>
          <button class="sec" (click)="deleteAll()" [disabled]="busy">🗑️ ลบลูกค้าทั้งหมด</button>
        </div>
        <p class="msg">💡 คลิกบนแผนที่เพื่อกำหนดพิกัดบ้านลูกค้า</p>
        <div #cmap class="cmap"></div>
      </section>

      <section class="card">
        <table>
          <thead><tr><th>#</th><th>ชื่อ</th><th>เบอร์โทร</th><th>ที่อยู่</th><th>พิกัด</th><th></th></tr></thead>
          <tbody>
            @for (c of list; track c.id) {
              <tr>
                <td>{{ c.id }}</td>
                <td>{{ c.firstname }} {{ c.lastname }}</td>
                <td>{{ c.phone }}</td>
                <td>{{ c.address }}</td>
                <td>{{ c.lat | number: '1.4-4' }}, {{ c.lng | number: '1.4-4' }}</td>
                <td>
                  <button class="sec" (click)="focusOn(c)">📍 ดูบนแผนที่</button>
                  <button class="sec" (click)="edit(c)">แก้ไข</button>
                  <button class="sec" (click)="del(c)">🗑️ ลบ</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="msg">ไม่พบลูกค้า</td></tr>
            }
          </tbody>
        </table>
      </section>
    </main>
  `,
})
export class CustomersComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cmap', { static: true }) cmapEl!: ElementRef<HTMLElement>;
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  list: Customer[] = [];
  search = '';
  editingId: number | null = null;
  f: Form = { ...BLANK };
  randCount = 10;
  busy = false;

  private map: any;
  private layer: any;
  private pick: any;

  ngOnInit() { this.load(); }

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

  load() {
    const q = this.search.trim();
    this.api.get<Customer[]>('/customer' + (q ? '?name=' + encodeURIComponent(q) : '')).subscribe({
      next: (r) => { this.list = r; this.drawMarkers(); },
      error: (e) => this.api.say('โหลดลูกค้าไม่ได้: ' + errMsg(e)),
    });
  }

  private showPick(lat: number, lng: number) {
    this.pick?.remove();
    this.pick = L.marker([lat, lng]).addTo(this.map).bindTooltip('พิกัดที่เลือก').openTooltip();
  }

  private drawMarkers() {
    if (!this.map) return;
    this.layer.clearLayers();
    L.marker([SHOP.lat, SHOP.lng], { icon: L.divIcon({ className: '', html: '<div class="pin" style="background:#222;width:30px;height:30px;font-size:16px">🏪</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindTooltip('ร้าน').addTo(this.layer);
    this.list.forEach((c) =>
      L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0e9384', fillOpacity: 1 })
        .bindPopup(`<b>${esc(c.firstname)} ${esc(c.lastname)}</b><br>${esc(c.phone)}<br>${esc(c.address)}`)
        .addTo(this.layer));
    if (this.list.length) {
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
    if (!f.firstname.trim() || !f.lastname.trim() || !f.phone.trim() || f.lat === '' || f.lng === '' || isNaN(lat) || isNaN(lng)) {
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

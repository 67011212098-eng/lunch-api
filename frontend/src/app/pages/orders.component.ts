import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, Customer, Order, errMsg, saveDate, startDate } from '../core/api';
import { ConfirmService } from '../core/confirm';
import { SHOP } from '../core/map';

// ช่อง type="number" ที่ลบจนว่างจะได้ null
const blank = (v: unknown) => v === '' || v == null;

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="max-w-[1100px] mx-auto p-[18px] grid grid-cols-1 gap-[18px]">
      <section class="card">
        <h2 class="text-[17px] font-bold mb-3">จัดการออเดอร์ <span class="text-sm text-mute">({{ rows.length }} ออเดอร์, {{ total }} กล่อง)</span></h2>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <label>วันที่ <input class="field" type="date" [(ngModel)]="date" (ngModelChange)="changeDate()"></label>
          <select class="field" [(ngModel)]="custId">
            @for (c of customers; track c.id) {
              <option [ngValue]="c.id">{{ c.firstname }} {{ c.lastname }} ({{ c.phone }})</option>
            }
          </select>
          <select class="field" [(ngModel)]="boxes">
            <option [ngValue]="1">1</option>
            <option [ngValue]="2">2</option>
            <option [ngValue]="3">3</option>
          </select>
          <span>กล่อง</span>
          <button class="btn" (click)="add()">➕ เพิ่มออเดอร์</button>
        </div>

        <div class="flex flex-wrap items-center gap-2 mb-3">
          <input #simInput class="field w-[190px]" type="number" min="1" max="60" [(ngModel)]="simCount" placeholder="จำนวน (ว่าง = สุ่ม 20–30)">
          <button class="btn-sec" (click)="simulate()">🎲 สุ่มออเดอร์ทดสอบ</button>
          <label class="flex items-center gap-1 text-sm text-mute">
            <input type="checkbox" [(ngModel)]="delSimCust"> ลบลูกค้าจำลองด้วย
          </label>
          <button class="btn-sec" (click)="clearOrders()">ลบออเดอร์ทั้งหมด</button>
        </div>

        <div class="max-h-[520px] overflow-auto">
          <table class="w-full text-sm">
            <thead><tr><th>#</th><th>ลูกค้า</th><th>เบอร์โทร</th><th>ที่อยู่</th><th class="text-right">จำนวน (กล่อง)</th><th></th></tr></thead>
            <tbody>
              @for (o of rows; track o.id) {
                <tr [id]="'order-' + o.id" [class.bg-brand-soft]="o.id === highlightId">
                  <td>{{ o.id }}</td>
                  <td>{{ o.firstname }} {{ o.lastname }}</td>
                  <td>{{ o.phone }}</td>
                  <td>{{ o.address }}</td>
                  <td class="text-right">
                    <select class="field" [ngModel]="o.boxes" (ngModelChange)="editBoxes(o, $event)">
                      <option [ngValue]="1">1</option>
                      <option [ngValue]="2">2</option>
                      <option [ngValue]="3">3</option>
                    </select>
                  </td>
                  <td><button class="btn-sec" (click)="del(o)">🗑️ ลบ</button></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-mute">ยังไม่มีออเดอร์ในวันนี้ — เพิ่มเองหรือกด "สุ่มออเดอร์ทดสอบ"</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-sm text-mute my-3.5">ลูกค้าสั่งได้ไม่เกิน 3 กล่องต่อออเดอร์ · แก้จำนวนกล่องได้จากช่องในตาราง</p>
      </section>

      <section #nearBox class="card">
        <h2 class="text-[17px] font-bold mb-3">ค้นหาออเดอร์ใกล้จุดที่เลือก
          @if (near) {
            <span class="text-sm text-mute">(รัศมี {{ near.radius }} กม. พบ {{ near.rows.length }} ออเดอร์, {{ nearBoxes }} กล่อง)</span>
          }
        </h2>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <input class="field w-[150px]" type="number" step="any" placeholder="ละติจูด (lat)" [(ngModel)]="nLat">
          <input class="field w-[150px]" type="number" step="any" placeholder="ลองจิจูด (lng)" [(ngModel)]="nLng">
          <input class="field w-[90px]" type="number" min="0.1" step="0.1" [(ngModel)]="nRadius"><span>กม.</span>
          <button class="btn" (click)="nearbyOrders()">📍 ค้นหา</button>
          <button class="btn-sec" (click)="useCustomerPoint()">ใช้พิกัดบ้านลูกค้าที่เลือกด้านบน</button>
        </div>
        @if (near) {
          <div class="max-h-[360px] overflow-auto">
            <table class="w-full text-sm">
              <thead><tr><th>#</th><th>วันที่</th><th>ลูกค้า</th><th>เบอร์โทร</th><th>ที่อยู่</th><th class="text-right">กล่อง</th><th class="text-right">ห่าง (กม.)</th></tr></thead>
              <tbody>
                @for (o of near.rows; track o.id) {
                  <tr>
                    <td>{{ o.id }}</td>
                    <td>{{ o.order_date }}</td>
                    <td>{{ o.firstname }} {{ o.lastname }}</td>
                    <td>{{ o.phone }}</td>
                    <td>{{ o.address }}</td>
                    <td class="text-right">{{ o.boxes }}</td>
                    <td class="text-right">{{ o.distance_km }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-mute">ไม่มีออเดอร์ในรัศมีนี้</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
        <p class="text-sm text-mute my-3.5">ค้นจากออเดอร์ทุกวัน เรียงจากใกล้ไปไกล · เว้นพิกัดว่างไว้ = ใช้ตำแหน่งร้าน</p>
      </section>
    </main>
  `,
})
export class OrdersComponent implements OnInit {
  @ViewChild('simInput', { static: true }) simInput!: ElementRef<HTMLInputElement>;
  @ViewChild('nearBox', { static: true }) nearBox!: ElementRef<HTMLElement>;
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  date = startDate();
  rows: Order[] = [];
  customers: Customer[] = [];
  custId: number | null = null;
  boxes = 1;
  simCount: number | null = null;
  delSimCust = false;
  highlightId = 0; // ออเดอร์ที่เปิดจากลิงก์ /order/:id
  nLat: number | null = null;
  nLng: number | null = null;
  nRadius: number | null = 2;
  near: { radius: number; rows: Order[] } | null = null;

  get total() { return this.rows.reduce((s, o) => s + o.boxes, 0); }
  get nearBoxes() { return (this.near?.rows ?? []).reduce((s, o) => s + o.boxes, 0); }

  // เปิดจากลิงก์ตามคู่มือได้: /order/:id (เปิดวันของออเดอร์นั้น) · /order/nearby?lat=&lng=&radius= · /order/simulate
  async ngOnInit() {
    const s = this.route.snapshot, q = s.queryParamMap, path = s.routeConfig?.path;
    this.loadCustomers();
    const id = path === 'order/:id' ? Number(s.paramMap.get('id')) : 0;
    if (id) await this.openOrder(id);
    this.load(() => id && document.getElementById('order-' + id)?.scrollIntoView({ block: 'center' }));
    if (path === 'order/nearby') {
      if (q.get('lat')) this.nLat = Number(q.get('lat'));
      if (q.get('lng')) this.nLng = Number(q.get('lng'));
      if (q.get('radius')) this.nRadius = Number(q.get('radius'));
      this.nearbyOrders(() => this.nearBox.nativeElement.scrollIntoView({ block: 'center' }));
    }
    if (path === 'order/simulate') this.simInput.nativeElement.focus();
  }

  // หาวันของออเดอร์จาก GET /order/nearby รอบร้านด้วยรัศมีที่กว้างพอครอบทุกออเดอร์
  private async openOrder(id: number) {
    try {
      const all = await firstValueFrom(this.api.get<Order[]>(`/order/nearby?lat=${SHOP.lat}&lng=${SHOP.lng}&radius=1000`));
      const o = all.find((x) => x.id === id);
      if (!o) { this.api.say('ไม่พบออเดอร์ id ' + id); return; }
      this.date = o.order_date;
      saveDate(o.order_date);
      this.highlightId = id;
    } catch (e) {
      this.api.say(errMsg(e));
    }
  }

  changeDate() {
    saveDate(this.date);
    this.load();
  }

  loadCustomers() {
    this.api.get<Customer[]>('/customer').subscribe((cs) => {
      this.customers = cs;
      if (!this.custId || !cs.some((c) => c.id === this.custId)) this.custId = cs[0]?.id ?? null;
    });
  }

  load(after?: () => void) {
    this.api.get<Order[]>('/order?date=' + this.date).subscribe({
      next: (r) => { this.rows = r; if (after) setTimeout(after); },
      error: (e) => this.api.say('โหลดออเดอร์ไม่ได้: ' + errMsg(e)),
    });
  }

  add() {
    if (!this.custId) { this.api.say('ยังไม่มีลูกค้า — เพิ่มลูกค้าก่อน'); return; }
    this.api.send('/order', 'POST', { customerId: this.custId, boxes: this.boxes, date: this.date }).subscribe({
      next: () => { this.api.say('เพิ่มออเดอร์แล้ว'); this.load(); },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  // สุ่มออเดอร์ทดสอบ (ไม่ใส่จำนวน = สุ่ม 20–30) ถ้าลูกค้าไม่พอระบบจะสร้างลูกค้าจำลองให้
  simulate() {
    const body: any = { date: this.date };
    if (this.simCount) body.count = Number(this.simCount);
    this.api.send<any>('/order/simulate', 'POST', body).subscribe({
      next: (r) => {
        this.api.say(`สุ่มออเดอร์แล้ว ${r.created} รายการ` + (r.newCustomers ? ` (สร้างลูกค้าจำลองเพิ่ม ${r.newCustomers} คน)` : ''));
        this.loadCustomers();
        this.load();
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  async clearOrders() {
    const withCust = this.delSimCust;
    if (!await this.confirm.ask('ลบออเดอร์ทั้งหมดในระบบ (ทุกวัน)' + (withCust ? ' และลูกค้าจำลองที่ระบบสร้างไว้' : '') + '?')) return;
    this.api.send<any>('/order/simulate' + (withCust ? '?customers=true' : ''), 'DELETE').subscribe({
      next: (r) => {
        this.api.say(`ลบออเดอร์ ${r.deleted_orders} รายการ` + (withCust ? ` และลูกค้าจำลอง ${r.deleted_customers} คน` : ''));
        this.loadCustomers();
        this.load();
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  editBoxes(o: Order, boxes: number) {
    this.api.send('/order/' + o.id, 'PUT', { boxes }).subscribe({
      next: () => { this.api.say('แก้จำนวนกล่องแล้ว'); this.load(); },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  del(o: Order) {
    this.api.send('/order/' + o.id, 'DELETE').subscribe({
      next: () => this.load(),
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  useCustomerPoint() {
    const c = this.customers.find((x) => x.id === this.custId);
    if (!c) { this.api.say('เลือกลูกค้าด้านบนก่อน'); return; }
    this.nLat = c.lat;
    this.nLng = c.lng;
  }

  // ค้นออเดอร์ทุกวันในรัศมีรอบพิกัดที่กรอก ถ้าเว้นว่างทั้งสองช่องใช้ตำแหน่งร้าน
  nearbyOrders(after?: () => void) {
    const empty = blank(this.nLat) && blank(this.nLng);
    const lat = empty ? SHOP.lat : Number(this.nLat), lng = empty ? SHOP.lng : Number(this.nLng), radius = Number(this.nRadius);
    if ((!empty && (blank(this.nLat) || blank(this.nLng))) || isNaN(lat) || isNaN(lng) || !(radius > 0)) {
      this.api.say('พิกัดและรัศมีต้องเป็นตัวเลข (รัศมีมากกว่า 0)');
      return;
    }
    this.api.get<Order[]>(`/order/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).subscribe({
      next: (rows) => {
        this.near = { radius, rows };
        this.location.replaceState('/order/nearby', `lat=${lat}&lng=${lng}&radius=${radius}`);
        if (after) setTimeout(after);
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }
}

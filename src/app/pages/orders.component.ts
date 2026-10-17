import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Customer, Order, errMsg, today } from '../core/api';
import { ConfirmService } from '../core/confirm';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main>
      <section class="card">
        <h2>จัดการออเดอร์ <span class="msg">({{ rows.length }} ออเดอร์, {{ total }} กล่อง)</span></h2>
        <div class="row">
          <label>วันที่ <input type="date" [(ngModel)]="date" (ngModelChange)="load()"></label>
          <select [(ngModel)]="custId">
            @for (c of customers; track c.id) {
              <option [ngValue]="c.id">{{ c.firstname }} {{ c.lastname }} ({{ c.phone }})</option>
            }
          </select>
          <select [(ngModel)]="boxes">
            <option [ngValue]="1">1</option>
            <option [ngValue]="2">2</option>
            <option [ngValue]="3">3</option>
          </select>
          <span>กล่อง</span>
          <button (click)="add()">➕ เพิ่มออเดอร์</button>
        </div>

        <div class="row">
          <input type="number" min="1" max="60" [(ngModel)]="simCount" placeholder="จำนวน (ว่าง = สุ่ม 20–30)" style="width:190px">
          <button class="sec" (click)="simulate()">🎲 สุ่มออเดอร์ทดสอบ</button>
          <label class="msg" style="display:flex;gap:4px;align-items:center">
            <input type="checkbox" [(ngModel)]="delSimCust"> ลบลูกค้าจำลองด้วย
          </label>
          <button class="sec" (click)="clearOrders()">ลบออเดอร์ทั้งหมด</button>
        </div>

        <table>
          <thead><tr><th>#</th><th>ลูกค้า</th><th>เบอร์โทร</th><th>ที่อยู่</th><th class="n">จำนวน (กล่อง)</th><th></th></tr></thead>
          <tbody>
            @for (o of rows; track o.id) {
              <tr>
                <td>{{ o.id }}</td>
                <td>{{ o.firstname }} {{ o.lastname }}</td>
                <td>{{ o.phone }}</td>
                <td>{{ o.address }}</td>
                <td class="n">
                  <select [ngModel]="o.boxes" (ngModelChange)="editBoxes(o, $event)">
                    <option [ngValue]="1">1</option>
                    <option [ngValue]="2">2</option>
                    <option [ngValue]="3">3</option>
                  </select>
                </td>
                <td><button class="sec" (click)="del(o)">🗑️ ลบ</button></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="msg">ยังไม่มีออเดอร์ในวันนี้ — เพิ่มเองหรือกด "สุ่มออเดอร์ทดสอบ"</td></tr>
            }
          </tbody>
        </table>
        <p class="msg">ลูกค้าสั่งได้ไม่เกิน 3 กล่องต่อออเดอร์</p>
      </section>
    </main>
  `,
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);
  date = today();
  rows: Order[] = [];
  customers: Customer[] = [];
  custId: number | null = null;
  boxes = 1;
  simCount: number | null = null;
  delSimCust = false;

  get total() { return this.rows.reduce((s, o) => s + o.boxes, 0); }

  ngOnInit() {
    this.loadCustomers();
    this.load();
  }

  loadCustomers() {
    this.api.get<Customer[]>('/customer').subscribe((cs) => {
      this.customers = cs;
      if (!this.custId || !cs.some((c) => c.id === this.custId)) this.custId = cs[0]?.id ?? null;
    });
  }

  load() {
    this.api.get<Order[]>('/order?date=' + this.date).subscribe({
      next: (r) => (this.rows = r),
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
}

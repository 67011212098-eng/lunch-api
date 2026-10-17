import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MoneyBreakdownComponent } from '../shared/money-breakdown.component';
import { firstValueFrom } from 'rxjs';
import { ApiService, errMsg, today } from '../core/api';
import { forgetDay, forgetPlan, rememberPlan } from '../core/plans';
import { ConfirmService } from '../core/confirm';
import { addBaseLayers } from '../core/map';

declare const L: any; // โหลดจาก CDN ใน index.html

const SHOP = { lat: 16.2469, lng: 103.2522 };
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// แผนที่อยู่ซ้าย แผงจัดเส้นทางอยู่ขวา สรุปการคำนวณเงินอยู่ด้านล่าง
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, MoneyBreakdownComponent],
  template: `
    <main class="wide">
      <div class="plan">
        <div #mapEl class="pmap"></div>

        <div class="pside">
          <section class="card">
            <h2>จัดเส้นทางจัดส่ง</h2>
            <div class="row">
              <label>วันที่ <input type="date" [(ngModel)]="date" (ngModelChange)="loadOrders()"></label>
            </div>
            <p class="msg">วันนี้มี {{ orders.length }} ออเดอร์ ({{ totalBoxes }} กล่อง)</p>
            <div class="row">
              <button (click)="optimize()" [disabled]="busy || !orders.length">{{ busy ? '⏳ กำลังคำนวณ…' : data ? '🔄 คำนวณใหม่' : 'คำนวณเส้นทาง' }}</button>
              <button class="sec" (click)="deleteDayPlans()">🗑️ ลบแผนที่ยืนยันของวันนี้</button>
            </div>

            @if (!data) {
              <p class="msg">กด "คำนวณเส้นทาง" เพื่อให้ระบบเสนอเส้นทางจัดส่ง เส้นทางจะขึ้นบนแผนที่ด้านซ้าย</p>
            } @else {
              @if (data.summary.profit < 0) {
                <div class="alert">⚠️ แผนนี้ <b>ขาดทุน {{ money(-data.summary.profit) }}</b> (ค่าไรเดอร์สูงกว่ากำไรจากอาหาร)
                  <div><button (click)="noLoss()" [disabled]="busy">คำนวณเส้นทางใหม่ให้ไม่ขาดทุน</button></div>
                </div>
              }
              @if (data.summary.lateCount) {
                <div class="alert warn">⏰ มี {{ data.summary.lateCount }} จุดที่ถึงช้ากว่ากำหนด 12:30</div>
              }
              <p>
                {{ data.summary.profit < 0 ? 'ขาดทุน' : 'กำไร' }}
                <b [class.neg]="data.summary.profit < 0" [class.pos]="data.summary.profit >= 0">{{ money(data.summary.profit) }}</b>
                · เสร็จ {{ data.summary.finishTime }}
                <span class="msg">(รายละเอียดด้านล่าง)</span>
              </p>
              <table>
                <thead><tr><th>ไรเดอร์</th><th class="n">จุด</th><th class="n">กล่อง</th><th class="n">กม.</th><th class="n">เสร็จ</th></tr></thead>
                <tbody>
                  @for (r of data.riders; track r.riderNo) {
                    <tr>
                      <td><span class="dot" [style.background]="r.color"></span>คนที่ {{ r.riderNo }}{{ r.lateCount ? ' ⏰' : '' }}</td>
                      <td class="n">{{ r.stops.length }}</td><td class="n">{{ r.boxes }}</td>
                      <td class="n">{{ r.km }}</td><td class="n">{{ r.finishTime }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <div class="row" style="margin:14px 0 0">
                <button (click)="confirmPlan()" [disabled]="!!confirmed">✅ ยืนยันแผนนี้</button>
              </div>
            }
          </section>

          @if (confirmed) {
            <section class="card">
              <h2>ยืนยันแผนแล้ว — เลขใบงานของไรเดอร์</h2>
              <p class="msg">แผน #{{ confirmed.planId }} · กำไร {{ money(confirmed.summary.profit) }}</p>
              <table>
                <thead><tr><th>ไรเดอร์</th><th>เลขใบงาน</th><th class="n">กล่อง</th><th class="n">เสร็จ</th></tr></thead>
                <tbody>
                  @for (r of confirmed.riders; track r.code) {
                    <tr>
                      <td><span class="dot" [style.background]="r.color"></span>คนที่ {{ r.riderNo }}</td>
                      <td><a [routerLink]="['/job', r.code]" target="_blank"><b style="font-size:18px;letter-spacing:2px">{{ r.code }}</b></a></td>
                      <td class="n">{{ r.boxes }}</td><td class="n">{{ r.finishTime }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="sec" (click)="clearPlan()" style="margin-top:10px">🧹 ส่งเสร็จแล้ว / ล้างแผน</button>
            </section>
          }
        </div>
      </div>

      @if (data) {
        <section class="card">
          <h2>สรุปการคำนวณ</h2>
          <div class="stats">
            <div class="stat"><span>รายได้</span><b>{{ money(data.summary.revenue) }}</b></div>
            <div class="stat"><span>ต้นทุนอาหาร</span><b>{{ money(data.summary.foodCost) }}</b></div>
            <div class="stat"><span>ค่าจ้างไรเดอร์</span><b>{{ money(data.summary.riderCost) }}</b></div>
            <div class="stat" [class.loss]="data.summary.profit < 0">
              <span>{{ data.summary.profit < 0 ? 'ขาดทุน' : 'กำไร' }}</span>
              <b [class.neg]="data.summary.profit < 0" [class.pos]="data.summary.profit >= 0">{{ money(data.summary.profit) }}</b>
            </div>
            <div class="stat"><span>เวลาที่ใช้ส่ง</span><b>{{ data.summary.durationMin | number: '1.0-0' }} นาที</b><span>เสร็จ {{ data.summary.finishTime }}</span></div>
            <div class="stat"><span>ไรเดอร์ / ระยะทางรวม</span><b>{{ data.summary.riders }} คน · {{ data.summary.totalKm }} กม.</b></div>
          </div>
          <app-money-breakdown [data]="data"></app-money-breakdown>
        </section>
      }
    </main>
  `,
})
export class GpsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLElement>;
  private api = inject(ApiService);
  private confirm = inject(ConfirmService);

  date = today();
  orders: any[] = [];
  data: any = null;       // ผลจาก /route/optimize (ยังไม่บันทึก)
  confirmed: any = null;  // ผลจาก /route/plan (บันทึกแล้ว)
  busy = false;
  money = (n: number) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ฿';

  private map: any;
  private layer: any;
  private token = 0;
  private roadCache = new Map<string, Promise<number[][] | null>>();

  get totalBoxes() { return this.orders.reduce((s, o) => s + o.boxes, 0); }

  ngOnInit() { this.loadOrders(); }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement).setView([SHOP.lat, SHOP.lng], 13);
    addBaseLayers(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.drawMap();
  }

  ngOnDestroy() { this.map?.remove(); }

  loadOrders() {
    this.data = null;
    this.confirmed = null;
    this.drawMap();
    this.api.get<any[]>('/order?date=' + this.date).subscribe({
      next: (r) => (this.orders = r),
      error: (e) => this.api.say('โหลดออเดอร์ไม่ได้: ' + errMsg(e)),
    });
  }

  optimize() {
    this.busy = true;
    this.api.send<any>('/route/optimize', 'POST', { date: this.date }).subscribe({
      next: (r) => {
        this.busy = false;
        if (!r.riders.length) { this.api.say('ไม่มีออเดอร์ในวันนี้'); return; }
        this.data = r;
        this.confirmed = null;
        this.drawMap();
      },
      error: (e) => { this.busy = false; this.api.say(errMsg(e)); },
    });
  }

  // สุ่มหลายรอบ เลือกแผนที่ไม่ขาดทุนหรือขาดทุนน้อยที่สุด
  async noLoss() {
    this.busy = true;
    let best: any = null;
    try {
      for (let i = 1; i <= 15; i++) {
        this.api.say(`กำลังหาเส้นทางที่ไม่ขาดทุน… (${i}/15)`);
        const d: any = await firstValueFrom(this.api.send<any>('/route/optimize', 'POST', { date: this.date }));
        if (!best || d.summary.profit > best.summary.profit) best = d;
        if (best.summary.profit >= 0) break;
      }
      this.data = best;
      this.drawMap();
      this.api.say(best.summary.profit >= 0 ? 'พบเส้นทางที่ไม่ขาดทุนแล้ว' : 'ลองแล้วยังขาดทุน — แสดงแผนที่ขาดทุนน้อยที่สุด');
    } catch (e: any) {
      this.api.say(errMsg(e));
    } finally {
      this.busy = false;
    }
  }

  async confirmPlan() {
    if (this.data.summary.profit < 0 && !(await this.confirm.ask('แผนนี้ขาดทุน ต้องการยืนยันจริงหรือไม่?'))) return;
    this.api.send<any>('/route/plan', 'POST', { date: this.date, seed: this.data.seed }).subscribe({
      next: (r) => {
        this.confirmed = r;
        rememberPlan(this.date, r);
        this.api.say('ยืนยันแผนแล้ว แจ้งเลขใบงานให้ไรเดอร์แต่ละคน (ดูย้อนหลังได้ที่เมนูไรเดอร์)');
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  async clearPlan() {
    if (!await this.confirm.ask('ล้างแผนนี้? แผนที่ยืนยันแล้วจะถูกลบออกจากระบบ และเลขใบงานจะใช้ไม่ได้ (ออเดอร์ยังอยู่)')) return;
    this.api.send('/route/plan/' + this.confirmed.planId, 'DELETE').subscribe({
      next: () => { forgetPlan(this.confirmed.planId); this.api.say('ล้างแผนแล้ว พร้อมจัดเส้นทางรอบใหม่'); this.loadOrders(); },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  async deleteDayPlans() {
    if (!await this.confirm.ask(`ลบแผนที่ยืนยันไว้ทั้งหมดของวันที่ ${this.date}? (ออเดอร์ไม่ถูกลบ)`)) return;
    this.api.send<any>('/route/plan?date=' + this.date, 'DELETE').subscribe({
      next: (r) => { forgetDay(this.date); this.api.say(`ลบแผนแล้ว ${r.affected_row} แผน`); this.loadOrders(); },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  // ยังไม่มีผลคำนวณ = แสดงแค่ร้าน, มีผลแล้ว = วาดเส้นทางของไรเดอร์ทุกคน
  drawMap() {
    if (!this.map) return;
    const token = ++this.token;
    this.layer.clearLayers();
    const all: number[][] = [[SHOP.lat, SHOP.lng]];
    L.marker([SHOP.lat, SHOP.lng], { icon: L.divIcon({ className: '', html: '<div class="pin" style="background:#222;width:30px;height:30px;font-size:16px">🏪</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindTooltip('ร้าน').addTo(this.layer);
    if (!this.data) { this.map.setView([SHOP.lat, SHOP.lng], 14); return; }

    for (const r of this.data.riders) {
      const pts = [[SHOP.lat, SHOP.lng], ...r.stops.map((s: any) => [s.lat, s.lng])];
      // วาดเส้นตรงประไปก่อน แล้วเปลี่ยนเป็นเส้นตามถนนจริงเมื่อ OSRM ตอบกลับ
      const fallback = L.polyline(pts, { color: r.color, weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(this.layer);
      this.roadRoute(pts).then((road) => {
        if (token !== this.token || !road) return;
        fallback.remove();
        L.polyline(road, { color: r.color, weight: 5, opacity: 0.9 }).addTo(this.layer);
      });
      r.stops.forEach((s: any, i: number) => {
        all.push([s.lat, s.lng]);
        L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: `<div class="pin" style="background:${r.color}">${i + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) })
          .bindPopup(`<b>ไรเดอร์คนที่ ${r.riderNo} · จุดที่ ${i + 1}</b><br>${esc(s.name)} (${esc(s.phone)})<br>${esc(s.address)}<br>${s.boxes} กล่อง · ถึง ${r.arrivals[i]}`)
          .addTo(this.layer);
      });
    }
    this.map.invalidateSize();
    this.map.fitBounds(all, { padding: [40, 40] });
  }

  private roadRoute(pts: number[][]): Promise<number[][] | null> {
    const key = pts.map((p) => p.join(',')).join(';');
    if (!this.roadCache.has(key)) {
      const url = 'https://router.project-osrm.org/route/v1/driving/' +
        pts.map((p) => p[1] + ',' + p[0]).join(';') + '?overview=full&geometries=geojson';
      this.roadCache.set(key, fetch(url)
        .then((r) => r.json())
        .then((j) => (j.routes?.[0] ? j.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]) : null))
        .catch(() => null));
    }
    return this.roadCache.get(key)!;
  }
}

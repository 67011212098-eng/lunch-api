import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MoneyBreakdownComponent } from '../shared/money-breakdown.component';
import { firstValueFrom } from 'rxjs';
import { ApiService, Order, errMsg, saveDate, startDate } from '../core/api';
import { forgetDay, forgetPlan, rememberPlan, serverPlan } from '../core/plans';
import { ConfirmService } from '../core/confirm';
import { SHOP, SHOP_PIN, addBaseLayers, stopPin } from '../core/map';

declare const L: any; // โหลดจาก CDN ใน index.html

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Stat = { label: string; value: string; note?: string; loss?: boolean; tone?: 'pos' | 'neg' };
type Chip = { text: string; tone: '' | 'up' | 'down' };
type RecalcNote = { n: number; seed: number; time: string; chips: Chip[]; how: string };

// คำนวณใหม่: ลองหลาย seed พร้อมกัน (seed ลงท้าย 1–9 ไม่ชนกับ seed ที่ backend สุ่มให้) แล้วเลือกแผนที่ยังไม่เคยเสนอ
const RECALC_TRIES = 6;
const variantSeed = () => Math.floor(Math.random() * 190000000) * 10 + 1 + Math.floor(Math.random() * 9);
const planSig = (p: any) => p.riders.map((r: any) => r.stops.map((s: any) => s.orderId).join('>')).sort().join('|');

// แผนที่คำนวณไว้ของแต่ละวัน จำในเครื่อง (ชื่อและรูปแบบเดียวกับหน้าเว็บเดิม)
const KEY = 'gpsState';
type Saved = { data: any; confirmedPlan: any; sig: string };

// แผนที่อยู่ซ้าย แผงจัดเส้นทางอยู่ขวา สรุปการคำนวณเงินอยู่ด้านล่าง
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, MoneyBreakdownComponent],
  template: `
    <main class="max-w-[1400px] mx-auto p-[18px] grid grid-cols-1 gap-[18px]">
      <div class="grid items-start gap-[18px] min-[901px]:grid-cols-[minmax(0,1fr)_420px]">
        <div #mapEl class="z-0 h-[360px] border border-line rounded-xl min-[901px]:sticky min-[901px]:top-3 min-[901px]:h-[calc(100vh-160px)] min-[901px]:min-h-[420px]"></div>

        <div class="grid gap-[18px]">
          <section class="card">
            <h2 class="text-[17px] font-bold mb-3">จัดเส้นทางจัดส่ง</h2>
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <label>วันที่ <input class="field" type="date" [(ngModel)]="date" (ngModelChange)="changeDate()"></label>
            </div>
            <p class="text-sm text-mute my-3.5">วันนี้มี {{ orders.length }} ออเดอร์ ({{ totalBoxes }} กล่อง)</p>
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <button class="btn" (click)="optimize()" [disabled]="busy || !orders.length">{{ busy ? '⏳ กำลังคำนวณ…' : data ? '🔄 คำนวณใหม่ / เสนอเส้นทางอื่น' : 'คำนวณเส้นทาง' }}</button>
              <button class="btn-sec" (click)="deleteDayPlans()">🗑️ ลบแผนที่ยืนยันทั้งหมดของวันที่เลือก</button>
            </div>

            @for (n of note ? [note] : []; track n.n) {
              <div class="bg-brand-soft border border-brand rounded-[10px] px-3 py-2.5 mb-3 animate-recalc">
                <b>🔄 คำนวณใหม่แล้ว</b> · ครั้งที่ {{ n.n }} · {{ n.time }} <span class="text-sm text-mute">(seed {{ n.seed }})</span>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  @for (c of n.chips; track c.text) {
                    <span class="bg-white border rounded-full px-2.5 py-0.5 text-[13px]" [class.border-line]="!c.tone"
                      [class.text-ok]="c.tone === 'up'" [class.border-ok]="c.tone === 'up'"
                      [class.text-bad]="c.tone === 'down'" [class.border-bad]="c.tone === 'down'">{{ c.text }}</span>
                  }
                </div>
                @if (n.how) { <div class="text-sm text-mute mt-1">{{ n.how }}</div> }
              </div>
            }

            @if (!data) {
              <p class="text-sm text-mute my-3.5">กด "คำนวณเส้นทาง" เพื่อให้ระบบเสนอเส้นทางจัดส่ง เส้นทางจะขึ้นบนแผนที่ด้านซ้าย</p>
            } @else {
              @if (data.summary.profit < 0) {
                <div class="bg-red-50 border border-bad text-red-800 rounded-[10px] p-3 mb-3">⚠️ แผนนี้ <b>ขาดทุน {{ money(-data.summary.profit) }}</b> (ค่าไรเดอร์สูงกว่ากำไรจากอาหาร)
                  <div class="mt-2"><button class="btn" (click)="noLoss()" [disabled]="busy">คำนวณเส้นทางใหม่ให้ไม่ขาดทุน</button></div>
                </div>
              }
              @if (data.summary.lateCount) {
                <div class="bg-yellow-50 border border-amber-500 text-amber-800 rounded-[10px] p-3 mb-3">⏰ มี {{ data.summary.lateCount }} จุดที่ถึงช้ากว่ากำหนด 12:30</div>
              }
              <p class="my-4">
                {{ data.summary.profit < 0 ? 'ขาดทุน' : 'กำไร' }}
                <b [class.text-bad]="data.summary.profit < 0" [class.text-ok]="data.summary.profit >= 0">{{ money(data.summary.profit) }}</b>
                · เสร็จ {{ data.summary.finishTime }}
                <span class="text-sm text-mute">(รายละเอียดด้านล่าง)</span>
              </p>
              <table class="w-full text-sm">
                <thead><tr><th>ไรเดอร์</th><th class="text-right">จุด</th><th class="text-right">กล่อง</th><th class="text-right">กม.</th><th class="text-right">เสร็จ</th></tr></thead>
                <tbody>
                  @for (r of data.riders; track r.riderNo) {
                    <tr>
                      <td><span class="inline-block w-3 h-3 rounded-full mr-1.5" [style.background]="r.color"></span>คนที่ {{ r.riderNo }}{{ r.lateCount ? ' ⏰' : '' }}</td>
                      <td class="text-right">{{ r.stops.length }}</td><td class="text-right">{{ r.boxes }}</td>
                      <td class="text-right">{{ r.km }}</td><td class="text-right">{{ r.finishTime }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <div class="flex flex-wrap items-center gap-2 mt-3.5">
                <button class="btn" (click)="confirmPlan()" [disabled]="!!confirmed">✅ ยืนยันแผนนี้</button>
                @if (confirmed) {
                  <span class="text-sm text-mute">มีแผนที่ยืนยันไว้แล้ว — กด "ส่งเสร็จแล้ว / ล้างแผน" ก่อนถ้าจะยืนยันแผนใหม่</span>
                }
              </div>
            }
          </section>

          @if (confirmed) {
            <section class="card">
              <h2 class="text-[17px] font-bold mb-3">ยืนยันแผนแล้ว — เลขใบงานของไรเดอร์</h2>
              <p class="text-sm text-mute my-3.5">แผน #{{ confirmed.planId }} · {{ confirmed.riders.length }} ไรเดอร์{{ confirmed.summary?.profit !== undefined ? ' · กำไร ' + money(confirmed.summary.profit) : '' }}</p>
              <table class="w-full text-sm">
                <thead><tr><th>ไรเดอร์</th><th>เลขใบงาน</th><th class="text-right">กล่อง</th><th class="text-right">เสร็จ</th></tr></thead>
                <tbody>
                  @for (r of confirmed.riders; track r.code) {
                    <tr>
                      <td><span class="inline-block w-3 h-3 rounded-full mr-1.5" [style.background]="r.color"></span>คนที่ {{ r.riderNo }}</td>
                      <td><a class="text-brand underline" [routerLink]="['/job', r.code]" target="_blank"><b class="text-lg tracking-[2px]">{{ r.code }}</b></a></td>
                      <td class="text-right">{{ r.boxes }}</td><td class="text-right">{{ r.finishTime }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="btn-sec mt-2.5" (click)="clearPlan()">🧹 ส่งเสร็จแล้ว / ล้างแผน</button>
            </section>
          }
        </div>
      </div>

      @if (data) {
        <section class="card">
          <h2 class="text-[17px] font-bold mb-3">สรุปการคำนวณ</h2>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5 mb-3.5">
            @for (s of stats; track s.label) {
              <div class="border rounded-[10px] px-3 py-2.5" [class.border-line]="!s.loss" [class.bg-red-50]="s.loss" [class.border-bad]="s.loss">
                <span class="block text-xs text-mute">{{ s.label }}</span>
                <b class="text-xl" [class.text-bad]="s.tone === 'neg'" [class.text-ok]="s.tone === 'pos'">{{ s.value }}</b>
                @if (s.note) { <span class="block text-xs text-mute">{{ s.note }}</span> }
              </div>
            }
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
  private route = inject(ActivatedRoute);

  date = startDate();
  orders: Order[] = [];
  data: any = null;       // ผลจาก /route/optimize (ยังไม่บันทึก)
  confirmed: any = null;  // ผลจาก /route/plan (บันทึกแล้ว) หรือแผนที่ดึงคืนจาก server
  busy = false;
  note: RecalcNote | null = null; // แถบบอกว่าคำนวณใหม่แล้วต่างจากแผนเดิมอย่างไร
  money = (n: number) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ฿';

  private map: any;
  private layer: any;
  private token = 0;
  private roadCache = new Map<string, Promise<number[][] | null>>();
  private recalcCount = 0;
  private seen = new Set<string>(); // แผนที่เสนอไปแล้วของวันนี้ ใช้กันเสนอแผนซ้ำ
  private sig = '';                 // ออเดอร์ตอนโหลด (id:กล่อง) ถ้าเปลี่ยน แผนที่จำไว้ใช้ไม่ได้

  get totalBoxes() { return this.orders.reduce((s, o) => s + o.boxes, 0); }

  // กล่องตัวเลขในส่วนสรุปการคำนวณ (กล่องกำไรเปลี่ยนเป็นสีแดงเมื่อขาดทุน)
  get stats(): Stat[] {
    const s = this.data.summary, loss = s.profit < 0;
    return [
      { label: 'รายได้', value: this.money(s.revenue) },
      { label: 'ต้นทุนอาหาร', value: this.money(s.foodCost) },
      { label: 'ค่าจ้างไรเดอร์', value: this.money(s.riderCost) },
      { label: loss ? 'ขาดทุน' : 'กำไร', value: this.money(s.profit), loss, tone: loss ? 'neg' : 'pos' },
      { label: 'เวลาที่ใช้ส่ง', value: Math.round(s.durationMin) + ' นาที', note: 'เสร็จ ' + s.finishTime },
      { label: 'ไรเดอร์ / ระยะทางรวม', value: `${s.riders} คน · ${s.totalKm} กม.` },
    ];
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id'); // เปิดจากลิงก์ /route/plan/:id ในคู่มือ
    if (id) this.api.say(`แผน #${id} ลบได้ด้วยปุ่ม "ส่งเสร็จแล้ว / ล้างแผน" หลังยืนยันแผน (ใบงานเปิดที่ /job/เลขใบงาน)`);
    this.loadOrders();
  }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement).setView([SHOP.lat, SHOP.lng], 13);
    addBaseLayers(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.drawMap();
  }

  ngOnDestroy() { this.map?.remove(); }

  changeDate() {
    saveDate(this.date);
    this.loadOrders();
  }

  loadOrders() {
    const date = this.date;
    this.data = null;
    this.confirmed = null;
    this.note = null;
    this.recalcCount = 0;
    this.seen.clear();
    this.drawMap();
    this.api.get<Order[]>('/order?date=' + date).subscribe({
      next: async (rows) => {
        if (date !== this.date) return;
        this.orders = rows;
        this.sig = rows.map((o) => o.id + ':' + o.boxes).join(',');
        if (!this.restoreLocal()) await this.restoreServer(rows);
      },
      error: (e) => this.api.say('โหลดออเดอร์ไม่ได้: ' + errMsg(e)),
    });
  }

  // แผนที่คำนวณ/ยืนยันไว้ในเครื่องนี้ ใช้ต่อได้ถ้าออเดอร์ของวันยังเหมือนตอนคำนวณ
  private restoreLocal(): boolean {
    const s = this.saved()[this.date];
    if (!s?.data?.riders) return false;
    if (s.sig !== this.sig) {
      this.api.say('ออเดอร์เปลี่ยนไปจากตอนคำนวณ จึงต้องคำนวณเส้นทางใหม่');
      this.forget();
      return false;
    }
    this.data = s.data;
    this.confirmed = s.confirmedPlan ?? null;
    this.seen.add(planSig(this.data));
    this.drawMap();
    return true;
  }

  // ยังไม่มีในเครื่องนี้: ดึงแผนที่ยืนยันแล้วของวันจาก server (เปิดจากเครื่องอื่นก็เห็นเลขใบงาน)
  private async restoreServer(rows: Order[]) {
    const p = await serverPlan(this.api, this.date, rows);
    if (p && p.date === this.date) this.confirmed = { ...p, summary: { riders: p.riders.length } };
  }

  private saved(): Record<string, Saved> {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
  }
  private save() {
    try {
      const all = this.saved();
      if (this.data) all[this.date] = { data: this.data, confirmedPlan: this.confirmed, sig: this.sig };
      else delete all[this.date];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {}
  }
  private forget() {
    try { const all = this.saved(); delete all[this.date]; localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  }

  private plan(date: string, seed?: number) {
    return firstValueFrom(this.api.send<any>('/route/optimize', 'POST', seed ? { date, seed } : { date }));
  }

  // ครั้งแรกคำนวณ 1 แผน · คำนวณใหม่: เลือกแผนกำไรสูงสุดที่ยังไม่เคยเสนอ กำไรไม่ต่ำกว่าเดิม (ถ้าเดิมขาดทุน) และไม่เลทเพิ่ม
  async optimize() {
    const prev = this.data, date = this.date;
    this.busy = true;
    try {
      let next: any = null, tried = 1, cands = 0;
      if (!prev) {
        next = await this.plan(date);
      } else {
        const res = await Promise.allSettled(Array.from({ length: RECALC_TRIES }, () => this.plan(date, variantSeed())));
        const plans = res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
        if (!plans.length) throw (res[0] as PromiseRejectedResult).reason;
        tried = plans.length;
        if (!plans[0].riders.length) next = plans[0];
        else {
          const floor = Math.min(0, prev.summary.profit);
          const fresh = plans.filter((p) => !this.seen.has(planSig(p)) && p.summary.profit >= floor && p.summary.lateCount <= prev.summary.lateCount);
          cands = fresh.length;
          next = fresh.sort((a, b) => b.summary.profit - a.summary.profit)[0] ?? null;
        }
      }
      if (next && !next.riders.length) {
        this.api.say('ไม่มีออเดอร์ในวันนี้');
        this.data = null;
        this.note = null;
        this.drawMap();
        return;
      }
      if (!next) {
        this.seen.clear();
        this.seen.add(planSig(prev));
        this.noteRecalc(prev, prev, tried, 0, true);
        this.api.say('ไม่พบแผนใหม่ที่ยังกำไร — คงแผนเดิมไว้');
        return;
      }
      this.data = next;
      this.seen.add(planSig(next));
      this.noteRecalc(prev, next, prev ? tried : 0, cands);
      if (this.note) this.api.say('คำนวณใหม่แล้ว — ได้แผนใหม่ที่ยังกำไร ดูรายละเอียดที่แถบด้านบน');
      this.save();
      this.drawMap();
    } catch (e) {
      this.api.say(errMsg(e));
    } finally {
      this.busy = false;
    }
  }

  // บอกส่วนต่างระหว่างแผนเดิมกับแผนใหม่ (สีเขียว = ดีขึ้น สีแดง = แย่ลง)
  private noteRecalc(prev: any, cur: any, tried = 0, cands = 0, none = false) {
    if (!prev) { this.note = null; return; }
    const a = prev.summary, b = cur.summary;
    const delta = (x: number, y: number) => Math.round((y - x) * 100) / 100;
    const changes: [string, number, number, (v: number) => string][] = [
      ['กำไร', delta(a.profit, b.profit), 1, (v) => this.money(v)],
      ['ค่าจ้างไรเดอร์', delta(a.riderCost, b.riderCost), -1, (v) => this.money(v)],
      ['ระยะทางรวม', delta(a.totalKm, b.totalKm), -1, (v) => v.toFixed(2) + ' กม.'],
      ['ไรเดอร์', delta(a.riders, b.riders), 0, (v) => v + ' คน'],
    ];
    const chips: Chip[] = none
      ? [{ text: `ลอง ${tried} แผน ยังไม่พบแผนใหม่ที่ยังกำไรและไม่เลท — คงแผนเดิมไว้`, tone: '' }]
      : tried && changes.every((c) => c[1] === 0)
        ? [{ text: 'ได้แผนใหม่ — กำไรและระยะทางเท่าเดิม แต่จัดไรเดอร์/ลำดับส่งต่างกัน', tone: 'up' }]
        : changes.map(([label, d, good, fmt]): Chip => d === 0
          ? { text: `${label} เท่าเดิม`, tone: '' }
          : { text: `${label} ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`, tone: good === 0 ? '' : d * good > 0 ? 'up' : 'down' });
    this.note = {
      n: ++this.recalcCount,
      seed: cur.seed,
      time: new Date().toLocaleTimeString('th-TH', { hour12: false }),
      chips,
      how: tried && !none ? `เลือกแผนกำไรสูงสุดจาก ${cands} แผนใหม่ที่ไม่ซ้ำ ไม่ขาดทุน ไม่เลท (ลอง ${tried} แผน)` : '',
    };
  }

  // สุ่มหลายรอบ เลือกแผนที่ไม่ขาดทุนหรือขาดทุนน้อยที่สุด
  async noLoss() {
    const prev = this.data;
    this.busy = true;
    let best: any = null;
    try {
      for (let i = 1; i <= 15; i++) {
        this.api.say(`กำลังหาเส้นทางที่ไม่ขาดทุน… (${i}/15)`);
        const d: any = await this.plan(this.date);
        if (!best || d.summary.profit > best.summary.profit) best = d;
        if (best.summary.profit >= 0) break;
      }
      this.data = best;
      this.seen.add(planSig(best));
      this.noteRecalc(prev, best);
      this.save();
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
        this.save();
        this.api.say('ยืนยันแผนแล้ว แจ้งเลขใบงานให้ไรเดอร์แต่ละคน (ดูย้อนหลังได้ที่เมนูไรเดอร์)');
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  async clearPlan() {
    if (!await this.confirm.ask('ล้างแผนนี้? แผนที่ยืนยันแล้วจะถูกลบออกจากระบบ และเลขใบงานจะใช้ไม่ได้ (ออเดอร์ยังอยู่)')) return;
    const id = this.confirmed.planId;
    this.api.send('/route/plan/' + id, 'DELETE').subscribe({
      next: () => this.cleared(id),
      // แผนถูกลบจากที่อื่นไปแล้วก็ล้างในหน้านี้ต่อได้
      error: (e) => (/not found/i.test(errMsg(e)) ? this.cleared(id) : this.api.say(errMsg(e))),
    });
  }

  private cleared(planId: number) {
    forgetPlan(planId);
    this.forget();
    this.api.say('ล้างแผนแล้ว พร้อมจัดเส้นทางรอบใหม่');
    this.loadOrders();
  }

  async deleteDayPlans() {
    const d = this.date;
    if (!await this.confirm.ask(`ลบแผนที่ยืนยันไว้ทั้งหมดของวันที่ ${d}? เลขใบงานของวันนั้นจะใช้ไม่ได้ (ออเดอร์ไม่ถูกลบ)`)) return;
    this.api.send<any>('/route/plan?date=' + encodeURIComponent(d), 'DELETE').subscribe({
      next: (r) => {
        forgetDay(d);
        this.forget();
        this.api.say(r.affected_row ? `ลบแผนของวันที่ ${d} แล้ว ${r.affected_row} แผน` : 'วันที่เลือกไม่มีแผนที่ยืนยันไว้');
        this.loadOrders();
      },
      error: (e) => this.api.say(errMsg(e)),
    });
  }

  // ยังไม่มีผลคำนวณ = แสดงแค่ร้าน, มีผลแล้ว = วาดเส้นทางของไรเดอร์ทุกคน
  drawMap() {
    if (!this.map) return;
    const token = ++this.token;
    this.layer.clearLayers();
    const all: number[][] = [[SHOP.lat, SHOP.lng]];
    L.marker([SHOP.lat, SHOP.lng], { icon: L.divIcon({ className: '', html: SHOP_PIN, iconSize: [30, 30], iconAnchor: [15, 15] }) })
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
        L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: stopPin(r.color, i + 1), iconSize: [24, 24], iconAnchor: [12, 12] }) })
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

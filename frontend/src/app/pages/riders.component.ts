import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JobCodeComponent } from '../shared/job-code.component';
import { ApiService, Order, errMsg, saveDate, startDate } from '../core/api';
import { SavedPlan, plansOn, serverPlan } from '../core/plans';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, JobCodeComponent],
  template: `
    <main class="max-w-[1100px] mx-auto p-[18px] grid grid-cols-1 gap-[18px]">
      <section class="card">
        <h2 class="text-[17px] font-bold mb-3">ดูใบงานด้วยเลข 6 หลัก</h2>
        <app-job-code />
      </section>

      <section class="card">
        <h2 class="text-[17px] font-bold mb-3">ไรเดอร์ที่ได้รับมอบหมาย</h2>
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <label>วันที่ <input class="field" type="date" [(ngModel)]="date" (ngModelChange)="load()"></label>
        </div>
        @for (p of plans; track p.planId) {
          <p class="text-sm text-mute my-3.5">แผน #{{ p.planId }} · กดที่ไรเดอร์เพื่อเปิดดูใบงาน</p>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5 mb-3">
            @for (r of p.riders; track r.code) {
              <a class="flex items-center gap-3 p-3 border border-line rounded-xl hover:border-brand" [routerLink]="['/job', r.code]">
                <span class="flex-none w-[38px] h-[38px] rounded-full text-white font-bold flex items-center justify-center" [style.background]="r.color">{{ r.riderNo }}</span>
                <span class="flex-1">ไรเดอร์คนที่ {{ r.riderNo }}<br><span class="text-sm text-mute">{{ r.boxes }} กล่อง · คาดว่าเสร็จ {{ r.finishTime }}</span>
                  <br><span class="text-sm" [class.text-bad]="status[r.code]?.startsWith('⚠️')">{{ status[r.code] || '…' }}</span></span>
                <b class="text-lg tracking-[2px] text-brand">{{ r.code }}</b>
              </a>
            }
          </div>
        } @empty {
          <p class="text-sm text-mute my-3.5">ยังไม่มีแผนที่ยืนยันของวันที่เลือก — ไปที่ <a class="text-brand underline" routerLink="/route/optimize">จัดเส้นทาง</a> แล้วกด "ยืนยันแผนนี้" เลขใบงานจะขึ้นที่นี่</p>
        }
      </section>
    </main>
  `,
})
export class RidersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  date = startDate();
  plans: SavedPlan[] = [];
  status: Record<string, string> = {}; // เลขใบงาน → จำนวนจุดและระยะทาง หรือแจ้งว่าแผนถูกยกเลิก
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.refresh(), 30000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  // แผนที่ยืนยันจากเครื่องนี้ รวมกับแผนล่าสุดของวันจาก server (ยืนยันจากเครื่องอื่นก็เห็น)
  load() {
    const date = this.date;
    saveDate(date);
    this.plans = plansOn(date);
    this.status = {};
    this.refresh();
    this.api.get<Order[]>('/order?date=' + date).subscribe(async (rows) => {
      const p = await serverPlan(this.api, date, rows);
      if (p && date === this.date && !this.plans.some((x) => x.planId === p.planId)) {
        this.plans = [...this.plans, p];
        this.refresh();
      }
    });
  }

  // เปิดใบงานของไรเดอร์แต่ละคน: ใช้ได้ = บอกจำนวนจุดและระยะทาง, ไม่พบ = แผนถูกลบไปแล้ว
  refresh() {
    for (const r of this.plans.flatMap((p) => p.riders)) {
      this.api.get<any>('/job/' + r.code).subscribe({
        next: (j) => (this.status[r.code] = `📍 ${j.stops.length} จุดส่ง · ${j.km} กม.`),
        error: (e) => (this.status[r.code] = /not found/i.test(errMsg(e)) ? '⚠️ แผนนี้ถูกยกเลิกแล้ว' : errMsg(e)),
      });
    }
  }
}

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JobCodeComponent } from '../shared/job-code.component';
import { ApiService, errMsg, today } from '../core/api';
import { plansOn } from '../core/plans';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, JobCodeComponent],
  template: `
    <main>
      <section class="card">
        <h2>ดูใบงานด้วยเลข 6 หลัก</h2>
        <app-job-code />
      </section>

      <section class="card">
        <h2>ไรเดอร์ที่ได้รับมอบหมาย</h2>
        <div class="row">
          <label>วันที่ <input type="date" [(ngModel)]="date" (ngModelChange)="load()"></label>
        </div>
        @for (p of plans; track p.planId) {
          <p class="msg">แผน #{{ p.planId }} · กดที่ไรเดอร์เพื่อเปิดดูใบงาน</p>
          <div class="riders">
            @for (r of p.riders; track r.code) {
              <a class="rider" [routerLink]="['/job', r.code]">
                <span class="num" [style.background]="r.color">{{ r.riderNo }}</span>
                <span style="flex:1">ไรเดอร์คนที่ {{ r.riderNo }}<br><span class="msg">{{ r.boxes }} กล่อง · คาดว่าเสร็จ {{ r.finishTime }}</span>
                  <br><span [class.okmsg]="status[r.code]?.startsWith('✅')" style="font-size:14px">{{ status[r.code] || '…' }}</span></span>
                <b class="code">{{ r.code }}</b>
              </a>
            }
          </div>
        } @empty {
          <p class="msg">ยังไม่มีแผนที่ยืนยันของวันนี้ — ไปที่ <a routerLink="/route/optimize">จัดเส้นทาง</a> แล้วกด "ยืนยันแผนนี้" เลขใบงานจะขึ้นที่นี่</p>
        }
      </section>
    </main>
  `,
})
export class RidersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  date = today();
  plans = plansOn(this.date);
  status: Record<string, string> = {}; // เลขใบงาน → สถานะการส่ง
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  load() {
    this.plans = plansOn(this.date);
    this.status = {};
    this.refresh();
  }

  // ดึงใบงานของไรเดอร์แต่ละคน ดูว่าส่งไปแล้วกี่จุด และส่งจุดล่าสุดเวลาเท่าไร
  refresh() {
    for (const r of this.plans.flatMap((p) => p.riders)) {
      this.api.get<any>('/job/' + r.code).subscribe({
        next: (j) => {
          const t: string[] = j.stops.map((s: any) => s.deliveredAt).filter(Boolean).sort();
          const last = t.length ? t[t.length - 1].slice(11, 16) + ' น.' : '';
          this.status[r.code] = t.length === j.stops.length ? `✅ ส่งครบแล้ว เสร็จ ${last}`
            : t.length ? `🛵 ส่งแล้ว ${t.length}/${j.stops.length} จุด · ล่าสุด ${last}`
            : `⏳ ยังไม่ได้ส่ง (0/${j.stops.length} จุด)`;
        },
        error: (e) => (this.status[r.code] = /not found/i.test(errMsg(e)) ? '⚠️ แผนนี้ถูกยกเลิกแล้ว' : errMsg(e)),
      });
    }
  }
}

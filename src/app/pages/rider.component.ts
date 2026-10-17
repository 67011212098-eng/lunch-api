import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService, errMsg } from '../core/api';
import { AuthService } from '../core/auth';
import { ConfirmService } from '../core/confirm';

@Component({
  standalone: true,
  template: `
    <div class="wrap">
      @if (err) {
        <div class="card" style="text-align:center"><div style="font-size:48px">⚠️</div><p>{{ err }}</p></div>
      }
      @if (job; as j) {
        <div class="head" [style.background]="j.color">ไรเดอร์คนที่ <b>{{ j.riderNo }}</b><br>วันที่ {{ j.date }}</div>
        @if (finishedAt) {
          <div class="alert ok">🎉 ส่งครบทุกจุดแล้ว · เสร็จเวลา <b>{{ hm(finishedAt) }} น.</b></div>
        }
        <div class="sum">
          <div><span>ข้าวกล่องที่ต้องหยิบ</span><b>{{ j.boxes }} กล่อง</b></div>
          <div><span>ส่งแล้ว</span><b>{{ done }} / {{ j.stops.length }} จุด</b></div>
          <div><span>ออกจากร้าน</span><b>{{ j.departTime }}</b></div>
          <div><span>ต้องส่งให้เสร็จก่อน</span><b>{{ j.deadlineTime }}</b></div>
        </div>
        <a class="b" [href]="j.mapUrl" target="_blank" rel="noopener">🗺️ เปิดแผนที่นำทางทั้งเส้นทาง</a>
        <h2>ลำดับการส่ง</h2>
        @for (s of j.stops; track s.seq) {
          <div class="card stop" [class.delivered]="s.deliveredAt">
            <div class="num" [style.background]="s.deliveredAt ? '#2f9e44' : j.color">{{ s.deliveredAt ? '✓' : s.seq }}</div>
            <div style="flex:1">
              <h3>จุดที่ {{ s.seq }}: บ้านคุณ {{ s.name }}</h3>
              <p>📍 {{ s.address }}</p>
              <p>📦 <span class="tag">{{ s.boxes }} กล่อง</span> · ถึงโดยประมาณ <b>{{ s.eta }}</b></p>
              @if (s.deliveredAt) {
                <p class="okmsg">✅ ส่งแล้ว เวลา {{ hm(s.deliveredAt) }} น.</p>
              } @else {
                <a class="b sec" [href]="'tel:' + s.phone">📞 โทร {{ s.phone }}</a>
                <a class="b" [href]="s.mapUrl" target="_blank" rel="noopener">🧭 นำทางไปจุดนี้</a>
                <button class="b ok" (click)="deliver(s)" [disabled]="busy">✅ ยืนยันส่งถึงแล้ว</button>
              }
            </div>
          </div>
        }
        <p class="msg" style="text-align:center">รวมระยะทาง {{ j.km }} กม. · คาดว่าเสร็จ {{ j.finishTime }}</p>
      }
    </div>
  `,
})
export class RiderComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  job: any = null;
  err = '';
  busy = false;
  hm = (t: string) => t.slice(11, 16);
  private timer?: ReturnType<typeof setInterval>;

  get done(): number { return this.job?.stops.filter((s: any) => s.deliveredAt).length ?? 0; }

  // เวลาที่ส่งจุดสุดท้าย (มีค่าเมื่อส่งครบทุกจุดแล้ว)
  get finishedAt(): string {
    const t: string[] = (this.job?.stops ?? []).map((s: any) => s.deliveredAt).filter(Boolean).sort();
    return t.length && t.length === this.job.stops.length ? t[t.length - 1] : '';
  }

  ngOnInit() {
    // ติดตามเลขใบงานใน URL (เปลี่ยนจากใบงานหนึ่งไปอีกใบโดยไม่ออกจากหน้านี้ได้)
    this.route.paramMap.subscribe((p) => {
      const code = p.get('code') || '';
      this.job = null;
      this.auth.riderView.set('ไรเดอร์');
      this.load(code);
      // เช็กทุก 15 วินาที ถ้าร้านลบแผนจะขึ้นว่าเลขใบงานใช้ไม่ได้แล้ว
      clearInterval(this.timer);
      this.timer = setInterval(() => this.load(code), 15000);
    });
  }

  load(code: string) {
    this.api.get<any>('/job/' + code).subscribe({
      next: (j) => { this.job = j; this.err = ''; this.auth.riderView.set('ไรเดอร์คนที่ ' + j.riderNo); },
      error: (e) => {
        this.job = null;
        this.err = /not found/i.test(errMsg(e))
          ? 'เลขใบงานนี้ใช้ไม่ได้ (ไม่มีเลขนี้ หรือแผนถูกยกเลิกแล้ว) ติดต่อร้านเพื่อขอเลขใหม่'
          : errMsg(e);
      },
    });
  }

  async deliver(s: any) {
    if (!(await this.confirm.ask(`ยืนยันว่าส่งจุดที่ ${s.seq} บ้านคุณ ${s.name} เรียบร้อยแล้ว?`))) return;
    this.busy = true;
    this.api.send<any>(`/job/${this.job.code}/stops/${s.seq}/delivered`, 'POST')
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: (r) => {
          s.deliveredAt = r.deliveredAt;
          this.api.say(`บันทึกแล้ว: ส่งจุดที่ ${s.seq} เวลา ${this.hm(r.deliveredAt)} น.`);
        },
        error: (e) => this.api.say(errMsg(e)),
      });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.auth.riderView.set('');
  }
}

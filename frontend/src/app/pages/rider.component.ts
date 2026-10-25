import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService, errMsg } from '../core/api';
import { AuthService } from '../core/auth';

@Component({
  standalone: true,
  template: `
    <div class="max-w-[480px] mx-auto p-3.5 text-[17px]">
      @if (err) {
        <div class="card text-center"><div class="text-5xl">⚠️</div><p class="my-4">{{ err }}</p></div>
      }
      @if (job; as j) {
        <div class="text-white rounded-[14px] p-3.5 mb-3" [style.background]="j.color">ไรเดอร์คนที่ <b>{{ j.riderNo }}</b><br>วันที่ {{ j.date }}</div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-white border border-line rounded-xl p-2.5 text-center"><span class="block text-[13px] text-mute">ข้าวกล่องที่ต้องหยิบ</span><b>{{ j.boxes }} กล่อง</b></div>
          <div class="bg-white border border-line rounded-xl p-2.5 text-center"><span class="block text-[13px] text-mute">จำนวนจุดส่ง</span><b>{{ j.stops.length }} จุด</b></div>
          <div class="bg-white border border-line rounded-xl p-2.5 text-center"><span class="block text-[13px] text-mute">ออกจากร้าน</span><b>{{ j.departTime }}</b></div>
          <div class="bg-white border border-line rounded-xl p-2.5 text-center"><span class="block text-[13px] text-mute">ต้องส่งให้เสร็จก่อน</span><b>{{ j.deadlineTime }}</b></div>
        </div>
        <a class="block text-center font-bold p-3 mt-2.5 rounded-xl bg-brand text-white" [href]="j.mapUrl" target="_blank" rel="noopener">🗺️ เปิดแผนที่นำทางทั้งเส้นทาง</a>
        <h2 class="text-2xl font-bold my-5">ลำดับการส่ง</h2>
        @for (s of j.stops; track s.seq) {
          <div class="card flex gap-3 mb-3">
            <div class="flex-none w-[38px] h-[38px] rounded-full text-white font-bold flex items-center justify-center" [style.background]="j.color">{{ s.seq }}</div>
            <div class="flex-1">
              <h3 class="text-xl font-bold my-4">จุดที่ {{ s.seq }}: บ้านคุณ {{ s.name }}</h3>
              <p class="my-4">📍 {{ s.address }}</p>
              <p class="my-4">📦 <span class="inline-block bg-brand-soft text-brand rounded-lg px-2 py-0.5 font-bold">{{ s.boxes }} กล่อง</span> · ถึงโดยประมาณ <b>{{ s.eta }}</b></p>
              <a class="block text-center font-bold p-3 mt-2.5 rounded-xl bg-white text-brand border-2 border-brand" [href]="'tel:' + s.phone">📞 โทร {{ s.phone }}</a>
              <a class="block text-center font-bold p-3 mt-2.5 rounded-xl bg-brand text-white" [href]="s.mapUrl" target="_blank" rel="noopener">🧭 นำทางไปจุดนี้</a>
            </div>
          </div>
        }
        <p class="text-sm text-mute text-center my-3.5">รวมระยะทาง {{ j.km }} กม. · คาดว่าเสร็จ {{ j.finishTime }}</p>
      }
    </div>
  `,
})
export class RiderComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  job: any = null;
  err = '';
  private timer?: ReturnType<typeof setInterval>;

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

  ngOnDestroy() {
    clearInterval(this.timer);
    this.auth.riderView.set('');
  }
}

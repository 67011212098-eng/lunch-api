import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, Customer, Order, today } from '../core/api';
import { plansOn } from '../core/plans';
import { JobCodeComponent } from '../shared/job-code.component';

@Component({
  standalone: true,
  imports: [RouterLink, JobCodeComponent],
  template: `
    <main class="max-w-[1100px] mx-auto p-[18px] grid grid-cols-1 gap-[18px]">
      <div class="text-center pt-2.5">
        <h2 class="text-2xl font-bold my-5">สวัสดีครับ 👋</h2>
        <p class="text-sm text-mute my-3.5">เลือกเมนูที่ต้องการใช้งาน</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3.5">
        @for (t of tiles; track t.link) {
          <a class="block bg-white border border-line rounded-[14px] p-5 hover:border-brand" [routerLink]="t.link">
            <div class="text-4xl">{{ t.icon }}</div>
            <h3 class="text-lg font-bold my-4">{{ t.title }}</h3>
            <p class="my-4">{{ t.desc }}</p>
            <b class="block mt-2.5 text-brand">{{ t.text() }}</b>
          </a>
        }
        <div class="bg-white border border-line rounded-[14px] p-5 hover:border-brand">
          <a routerLink="/rider"><div class="text-4xl">🛵</div><h3 class="text-lg font-bold my-4">ไรเดอร์</h3></a>
          <p class="my-4">กรอกเลขใบงาน 6 หลัก หรือกดเข้าไปดูไรเดอร์ที่ได้รับมอบหมาย</p>
          <app-job-code />
          <a routerLink="/rider"><b class="block mt-2.5 text-brand">{{ riderText }}</b></a>
        </div>
      </div>
    </main>
  `,
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  custText = '';
  orderText = '';
  riderText = '';

  // เมนูที่เป็นลิงก์ทั้งการ์ด (การ์ดไรเดอร์มีช่องกรอกเลขใบงาน จึงเขียนแยกใน template)
  tiles = [
    { link: '/customer', icon: '👥', title: 'ลูกค้า', desc: 'จัดการชื่อ เบอร์โทร และพิกัดบ้านลูกค้า', text: () => this.custText },
    { link: '/order', icon: '📦', title: 'ออเดอร์', desc: 'เพิ่ม ลบ และแก้จำนวนกล่องของแต่ละวัน', text: () => this.orderText },
    { link: '/route/optimize', icon: '🗺️', title: 'จัดเส้นทางจัดส่ง', desc: 'ให้ระบบแบ่งงานไรเดอร์ ดูเส้นทางบนแผนที่ และสรุปกำไร/ขาดทุน', text: () => 'เริ่มจัดเส้นทาง' },
  ];

  ngOnInit() {
    const n = plansOn(today()).reduce((s, p) => s + p.riders.length, 0);
    this.riderText = n ? `วันนี้มอบหมายแล้ว ${n} คน · ดูทั้งหมด →` : 'ดูหน้าไรเดอร์ →';

    forkJoin([
      this.api.get<Customer[]>('/customer'),
      this.api.get<Order[]>('/order?date=' + today()),
    ]).subscribe({
      next: ([cs, os]) => {
        this.custText = `ลูกค้าทั้งหมด ${cs.length} คน`;
        this.orderText = `วันนี้ ${os.length} ออเดอร์ · ${os.reduce((s, o) => s + o.boxes, 0)} กล่อง`;
      },
    });
  }
}
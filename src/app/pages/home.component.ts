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
    <main>
      <div class="hello"><h2>สวัสดีครับ 👋</h2><p class="msg">เลือกเมนูที่ต้องการใช้งาน</p></div>
      <div class="menu">
        <a class="tile" routerLink="/customer">
          <div class="ic">👥</div><h3>ลูกค้า</h3>
          <p>จัดการชื่อ เบอร์โทร และพิกัดบ้านลูกค้า</p><b>{{ custText }}</b>
        </a>
        <a class="tile" routerLink="/order">
          <div class="ic">📦</div><h3>ออเดอร์</h3>
          <p>เพิ่ม ลบ และแก้จำนวนกล่องของแต่ละวัน</p><b>{{ orderText }}</b>
        </a>
        <a class="tile" routerLink="/route/optimize">
          <div class="ic">🗺️</div><h3>จัดเส้นทางจัดส่ง</h3>
          <p>ให้ระบบแบ่งงานไรเดอร์ ดูเส้นทางบนแผนที่ และสรุปกำไร/ขาดทุน</p><b>เริ่มจัดเส้นทาง</b>
        </a>
        <div class="tile">
          <a routerLink="/rider"><div class="ic">🛵</div><h3>ไรเดอร์</h3></a>
          <p>กรอกเลขใบงาน 6 หลัก หรือกดเข้าไปดูไรเดอร์ที่ได้รับมอบหมาย</p>
          <app-job-code />
          <a routerLink="/rider"><b>{{ riderText }}</b></a>
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
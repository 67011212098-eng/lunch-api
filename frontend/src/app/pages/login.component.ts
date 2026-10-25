import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, OWNER } from '../core/auth';
import { ApiService, errMsg } from '../core/api';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-[400px] mx-auto my-10 p-4">
      <div class="text-center mb-4">
        <span class="text-[44px]">🛵</span>
        <h1 class="text-[32px] font-bold my-5">เส้นทางอร่อย</h1>
        <p class="text-sm text-mute my-3.5">ระบบจัดเส้นทางและแบ่งงานไรเดอร์</p>
      </div>
      <div class="card">
        <div class="grid grid-cols-2 gap-2.5 mb-4">
          <button [class]="roleBtn(role === 'owner')" (click)="role = 'owner'">🏪 เจ้าของร้าน</button>
          <button [class]="roleBtn(role === 'rider')" (click)="role = 'rider'">🛵 ไรเดอร์</button>
        </div>
        @if (role === 'owner') {
          <label class="block text-sm text-mute mt-2.5 mb-1">ชื่อผู้ใช้</label>
          <input class="field w-full text-[17px]" [(ngModel)]="user" autocomplete="username">
          <label class="block text-sm text-mute mt-2.5 mb-1">รหัสผ่าน</label>
          <input class="field w-full text-[17px]" type="password" [(ngModel)]="pass" autocomplete="current-password">
          <button class="btn w-full mt-4 py-[13px] font-bold" (click)="loginOwner()">เข้าสู่ระบบ</button>
        } @else {
          <label class="block text-sm text-mute mt-2.5 mb-1">เลขใบงาน 6 หลัก (ที่ร้านแจ้งให้)</label>
          <input class="field w-full text-[17px]" [(ngModel)]="code" inputmode="numeric" maxlength="6" placeholder="••••••">
          <button class="btn w-full mt-4 py-[13px] font-bold" (click)="loginRider()">เข้าสู่ระบบ</button>
        }
        <div class="text-red-700 text-sm min-h-[22px] mt-2.5">{{ err }}</div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  role: 'owner' | 'rider' = 'owner';
  user = '';
  pass = '';
  code = '';
  err = '';

  // ปุ่มเลือกบทบาท: ที่เลือกอยู่มีกรอบสีหลักและพื้นสีอ่อน
  roleBtn(on: boolean) {
    return 'px-3.5 py-2 rounded-lg border-2 text-ink ' + (on ? 'border-brand bg-brand-soft font-bold' : 'border-line bg-white');
  }

  loginOwner() {
    if (this.user.trim() === OWNER.username && this.pass === OWNER.password) {
      this.auth.login({ role: 'owner', name: 'เจ้าของร้าน' });
      this.router.navigateByUrl('/');
    } else {
      this.err = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    }
  }

  loginRider() {
    const c = this.code.trim();
    if (!/^\d{6}$/.test(c)) { this.err = 'เลขใบงานต้องเป็นตัวเลข 6 หลัก'; return; }
    this.api.get<any>('/job/' + c).subscribe({
      next: (job) => {
        this.auth.login({ role: 'rider', name: 'ไรเดอร์คนที่ ' + job.riderNo, code: c });
        this.router.navigateByUrl('/job/' + c);
      },
      error: (e) => (this.err = /not found/i.test(errMsg(e)) ? 'ไม่พบเลขใบงานนี้ ตรวจเลขอีกครั้ง' : errMsg(e)),
    });
  }
}

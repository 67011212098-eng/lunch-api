import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, OWNER } from '../core/auth';
import { ApiService, errMsg } from '../core/api';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login">
      <div class="logo"><span class="ic">🛵</span><h1>เส้นทางอร่อย</h1><p class="msg">ระบบจัดเส้นทางและแบ่งงานไรเดอร์</p></div>
      <div class="card">
        <div class="roles">
          <button [class.on]="role === 'owner'" (click)="role = 'owner'">🏪 เจ้าของร้าน</button>
          <button [class.on]="role === 'rider'" (click)="role = 'rider'">🛵 ไรเดอร์</button>
        </div>
        @if (role === 'owner') {
          <label>ชื่อผู้ใช้</label>
          <input [(ngModel)]="user" autocomplete="username">
          <label>รหัสผ่าน</label>
          <input type="password" [(ngModel)]="pass" autocomplete="current-password">
          <button class="go" (click)="loginOwner()">เข้าสู่ระบบ</button>
        } @else {
          <label>เลขใบงาน 6 หลัก (ที่ร้านแจ้งให้)</label>
          <input [(ngModel)]="code" inputmode="numeric" maxlength="6" placeholder="••••••">
          <button class="go" (click)="loginRider()">เข้าสู่ระบบ</button>
        }
        <div class="err">{{ err }}</div>
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

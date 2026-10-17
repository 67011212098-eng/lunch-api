import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';
import { ApiService } from './core/api';
import { ConfirmService } from './core/confirm';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.session(); as s) {
      @if (s.role === 'owner' && auth.riderView()) {
        <!-- เจ้าของร้านเปิดใบงาน: หน้าตาเหมือนไรเดอร์ทุกอย่าง มีแค่ปุ่มกลับหน้าร้าน -->
        <header>
          <h1>🛵 เส้นทางอร่อย</h1>
          <span>🛵 {{ auth.riderView() }}</span>
          <button class="back" (click)="backToShop()">🏪 กลับหน้าร้าน</button>
        </header>
      } @else {
        <header>
          <h1>🛵 เส้นทางอร่อย</h1>
          <span>{{ s.role === 'owner' ? '🏪 เจ้าของร้าน' : '🛵 ' + s.name }}</span>
          <button class="back" (click)="logout()">ออกจากระบบ</button>
        </header>
      }
      @if (s.role === 'owner' && !auth.riderView()) {
        <nav>
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">🏠 หน้าหลัก</a>
          <a routerLink="/customer" routerLinkActive="on">👥 ลูกค้า</a>
          <a routerLink="/order" routerLinkActive="on">📦 ออเดอร์</a>
          <a routerLink="/route/optimize" routerLinkActive="on">🗺️ จัดเส้นทาง</a>
          <a routerLink="/rider" routerLinkActive="on">🛵 ไรเดอร์</a>
        </nav>
      }
    }
    <router-outlet />
    @if (api.notice(); as msg) {
      <div class="toast">{{ msg }}</div>
    }
    @if (confirm.message(); as m) {
      <div class="modal open ask" (click)="confirm.answer(false)">
        <div class="abox" (click)="$event.stopPropagation()">
          <p>{{ m }}</p>
          <div class="row">
            <button class="sec" (click)="confirm.answer(false)">ยกเลิก</button>
            <button (click)="confirm.answer(true)">ตกลง</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppComponent {
  auth = inject(AuthService);
  api = inject(ApiService);
  confirm = inject(ConfirmService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  backToShop() {
    this.router.navigateByUrl('/rider');
  }
}
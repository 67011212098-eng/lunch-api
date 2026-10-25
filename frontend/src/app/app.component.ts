import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';
import { ApiService } from './core/api';
import { ConfirmService } from './core/confirm';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    @if (auth.session(); as s) {
      @if (s.role === 'owner' && auth.riderView()) {
        <!-- เจ้าของร้านเปิดใบงาน: หน้าตาเหมือนไรเดอร์ทุกอย่าง มีแค่ปุ่มกลับหน้าร้าน -->
        <header class="bg-brand text-white px-5 py-3.5 flex flex-wrap items-center gap-4">
          <h1 class="flex-1 text-xl font-bold">🛵 เส้นทางอร่อย</h1>
          <span>🛵 {{ auth.riderView() }}</span>
          <button class="btn bg-white/20 border border-white/60" (click)="backToShop()">🏪 กลับหน้าร้าน</button>
        </header>
      } @else {
        <header class="bg-brand text-white px-5 py-3.5 flex flex-wrap items-center gap-4">
          <h1 class="flex-1 text-xl font-bold">🛵 เส้นทางอร่อย</h1>
          <span>{{ s.role === 'owner' ? '🏪 เจ้าของร้าน' : '🛵 ' + s.name }}</span>
          <button class="btn bg-white/20 border border-white/60" (click)="logout()">ออกจากระบบ</button>
        </header>
      }
      @if (s.role === 'owner' && !auth.riderView()) {
        <nav class="bg-white border-b border-line flex gap-1 px-3.5 overflow-x-auto">
          @for (m of menu; track m.link) {
            <a [routerLink]="m.link" class="px-4 py-3 border-b-[3px] whitespace-nowrap"
               [class]="on(m.base) ? 'text-brand border-brand font-bold' : 'text-mute border-transparent'">{{ m.label }}</a>
          }
        </nav>
      }
    }
    <router-outlet />
    @if (api.notice(); as msg) {
      <div class="fixed left-1/2 bottom-5 -translate-x-1/2 z-[3000] bg-ink text-white px-[18px] py-2.5 rounded-lg">{{ msg }}</div>
    }
    @if (confirm.message(); as m) {
      <div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/[.55] px-[2vw] py-[2vh]" (click)="confirm.answer(false)">
        <div class="bg-white rounded-xl p-[18px] w-full max-w-[420px]" (click)="$event.stopPropagation()">
          <p class="mb-4 leading-relaxed">{{ m }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <button class="btn-sec" (click)="confirm.answer(false)">ยกเลิก</button>
            <button class="btn" (click)="confirm.answer(true)">ตกลง</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppComponent {
  // base = ส่วนต้นของ URL ที่นับเป็นเมนูนั้น (เช่น /customer/nearby, /route/plan/5)
  menu = [
    { link: '/', base: '/', label: '🏠 หน้าหลัก' },
    { link: '/customer', base: '/customer', label: '👥 ลูกค้า' },
    { link: '/order', base: '/order', label: '📦 ออเดอร์' },
    { link: '/route/optimize', base: '/route', label: '🗺️ จัดเส้นทาง' },
    { link: '/rider', base: '/rider', label: '🛵 ไรเดอร์' },
  ];
  auth = inject(AuthService);
  api = inject(ApiService);
  confirm = inject(ConfirmService);
  private router = inject(Router);

  on(base: string) {
    const path = this.router.url.split(/[?#]/)[0];
    return base === '/' ? path === '/' : path.startsWith(base);
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  backToShop() {
    this.router.navigateByUrl('/rider');
  }
}
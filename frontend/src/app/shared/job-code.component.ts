import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errMsg } from '../core/api';

// ช่องกรอกเลขใบงาน 6 หลัก ให้เจ้าของร้านเปิดดูหน้าไรเดอร์
@Component({
  selector: 'app-job-code',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <input class="field flex-1 min-w-0" [(ngModel)]="code" (keyup.enter)="open()" inputmode="numeric" maxlength="6" placeholder="เลขใบงาน 6 หลัก">
      <button class="btn" (click)="open()">ดูใบงาน</button>
    </div>
    <div class="text-red-700 text-sm min-h-[22px] mt-2.5">{{ err }}</div>
  `,
})
export class JobCodeComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  code = '';
  err = '';

  open() {
    const c = this.code.trim();
    if (!/^\d{6}$/.test(c)) { this.err = 'เลขใบงานต้องเป็นตัวเลข 6 หลัก'; return; }
    this.err = '';
    this.api.get('/job/' + c).subscribe({
      next: () => this.router.navigate(['/job', c]),
      error: (e) => (this.err = /not found/i.test(errMsg(e)) ? 'ไม่พบเลขใบงานนี้ ตรวจเลขอีกครั้ง' : errMsg(e)),
    });
  }
}

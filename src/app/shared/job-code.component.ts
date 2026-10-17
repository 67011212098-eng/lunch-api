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
    <div class="row" style="margin:0">
      <input [(ngModel)]="code" (keyup.enter)="open()" inputmode="numeric" maxlength="6" placeholder="เลขใบงาน 6 หลัก" style="flex:1;min-width:0">
      <button (click)="open()">ดูใบงาน</button>
    </div>
    <div class="err">{{ err }}</div>
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

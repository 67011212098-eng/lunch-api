import { Injectable, signal } from '@angular/core';

// หน้าต่างยืนยันในหน้าเว็บ ใช้แทน window.confirm ซึ่งบางเบราว์เซอร์ (เช่นเบราว์เซอร์ในแอป) ไม่แสดงและตอบ "ยกเลิก" ทันที
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  message = signal('');
  private done?: (ok: boolean) => void;

  ask(message: string): Promise<boolean> {
    this.done?.(false);
    this.message.set(message);
    return new Promise((resolve) => (this.done = resolve));
  }

  answer(ok: boolean) {
    this.message.set('');
    this.done?.(ok);
    this.done = undefined;
  }
}

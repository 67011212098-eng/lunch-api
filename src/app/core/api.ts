import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// ไม่ระบุ: เปิดผ่านพอร์ต 3000 หรือโดเมนจริง ใช้ origin เดียวกัน ส่วนกรณีอื่นใช้ 127.0.0.1:3000
export const API_BASE = location.port === '3000' || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? location.origin
  : 'http://127.0.0.1:3000';

export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
export const errMsg = (e: any): string => e?.status === 0
  ? 'เชื่อมต่อ backend ไม่ได้ — ตรวจว่าเปิดเซิร์ฟเวอร์ backend (พอร์ต 3000) ไว้แล้ว'
  : e?.error?.message || e?.error?.error || e?.message || 'เกิดข้อผิดพลาด';

export interface Customer { id: number; firstname: string; lastname: string; phone: string; address: string; lat: number; lng: number; }
export interface Order { id: number; firstname: string; lastname: string; phone: string; address: string; boxes: number; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  notice = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  get<T>(path: string) {
    return this.http.get<T>(API_BASE + path);
  }
  send<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    return this.http.request<T>(method, API_BASE + path, { body });
  }
  say(msg: string) {
    this.notice.set(msg);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.notice.set(''), 3500);
  }
}

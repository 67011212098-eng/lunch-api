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

// วันที่ที่เลือกใช้ร่วมกันทุกหน้าในแท็บนี้ ลิงก์ที่มี ?date=YYYY-MM-DD จะเปิดวันนั้น
export function startDate(): string {
  const q = new URLSearchParams(location.search).get('date');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) saveDate(q);
  try { return sessionStorage.getItem('date') || today(); } catch { return today(); }
}
export const saveDate = (d: string) => { try { sessionStorage.setItem('date', d); } catch {} };

export interface Customer { id: number; firstname: string; lastname: string; phone: string; address: string; lat: number; lng: number; distance_km?: number; }
export interface Order {
  id: number; customer_id: number; boxes: number; order_date: string;
  firstname: string; lastname: string; phone: string; address: string; lat: number; lng: number;
  plan_id?: number | null; job_code?: string | null; distance_km?: number;
}

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

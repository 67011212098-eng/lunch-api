import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export interface Session { role: 'owner' | 'rider'; name: string; code?: string; exp: number; }

// ใช้เฉพาะตอนเดโม/ทดสอบ (เหมือนไฟล์เดิม) ของจริงต้องตรวจที่ backend
export const OWNER = { username: 'owner', password: 'lunch1234' };
const KEY = 'auth', TTL = 12 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ชื่อไรเดอร์ของใบงานที่เปิดอยู่ (ว่าง = ไม่ได้อยู่หน้าใบงาน) เจ้าของร้านที่เปิดใบงานจะเห็นหน้าเหมือนไรเดอร์ทุกอย่าง
  riderView = signal('');

  session(): Session | null {
    try {
      const a: Session = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (a && a.exp > Date.now()) return a;
    } catch {}
    return null;
  }
  login(s: Omit<Session, 'exp'>) {
    localStorage.setItem(KEY, JSON.stringify({ ...s, exp: Date.now() + TTL }));
  }
  logout() {
    localStorage.removeItem(KEY);
  }
}

// หน้าของเจ้าของร้าน: ยังไม่ล็อกอินให้ไปหน้า login, ไรเดอร์ให้ไปดูใบงานของตัวเอง
export const ownerGuard: CanActivateFn = () => {
  const s = inject(AuthService).session();
  const router = inject(Router);
  if (!s) return router.createUrlTree(['/login']);
  return s.role === 'owner' ? true : router.createUrlTree(['/job', s.code]);
};

// ใบงาน: ไรเดอร์ที่ล็อกอินแล้วดูได้เฉพาะใบงานของตัวเอง เจ้าของร้านดูได้ทุกใบ
export const jobGuard: CanActivateFn = (route) => {
  const s = inject(AuthService).session();
  if (s?.role === 'rider' && route.paramMap.get('code') !== s.code) return inject(Router).createUrlTree(['/job', s.code]);
  return true;
};

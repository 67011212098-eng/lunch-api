import { firstValueFrom } from 'rxjs';
import { ApiService, Order } from './api';

// เก็บเลขใบงานของแผนที่ยืนยันไว้ในเครื่องเจ้าของร้าน และดึงแผนล่าสุดของวันคืนจาก server ได้ (ดู serverPlan)
export interface PlanRider { riderNo: number; code: string; color: string; boxes: number; finishTime: string; }
export interface SavedPlan { planId: number; date: string; riders: PlanRider[]; }

const KEY = 'plans';

const read = (): SavedPlan[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const write = (ps: SavedPlan[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(ps.slice(-50))); } catch {}
};

export const plansOn = (date: string) => read().filter((p) => p.date === date);

// r คือผลจาก POST /route/plan
export function rememberPlan(date: string, r: any) {
  const riders = r.riders.map(({ riderNo, code, color, boxes, finishTime }: PlanRider) => ({ riderNo, code, color, boxes, finishTime }));
  write([...read().filter((p) => p.planId !== r.planId), { planId: r.planId, date, riders }]);
}
export const forgetPlan = (planId: number) => write(read().filter((p) => p.planId !== planId));
export const forgetDay = (date: string) => write(read().filter((p) => p.date !== date));

// แผนจาก server: GET /order บอก plan_id และ job_code ของแต่ละออเดอร์ แล้วเปิด GET /job ทีละใบ
// ใช้ได้เมื่อทุกออเดอร์ของวันอยู่ในแผนล่าสุดแผนเดียวกัน และจำนวนจุด/กล่องในใบงานตรงกับออเดอร์
export async function serverPlan(api: ApiService, date: string, rows: Order[]): Promise<SavedPlan | null> {
  const planId = Math.max(0, ...rows.map((o) => o.plan_id || 0));
  if (!planId || rows.some((o) => o.plan_id !== planId)) return null;
  try {
    const codes = [...new Set(rows.map((o) => o.job_code))];
    const jobs = await Promise.all(codes.map((c) => firstValueFrom(api.get<any>('/job/' + c))));
    const sum = (a: any[], f: (x: any) => number) => a.reduce((t, x) => t + f(x), 0);
    if (sum(jobs, (j) => j.stops.length) !== rows.length || sum(jobs, (j) => j.boxes) !== sum(rows, (o) => o.boxes)) return null;
    const riders = jobs
      .map((j) => ({ riderNo: j.riderNo, code: j.code, color: j.color, boxes: j.boxes, finishTime: j.finishTime }))
      .sort((a, b) => a.riderNo - b.riderNo);
    return { planId, date, riders };
  } catch {
    return null;
  }
}

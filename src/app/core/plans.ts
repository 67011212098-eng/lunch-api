// หน้าเว็บไม่มี API ดึงรายการแผนที่ยืนยันแล้ว จึงเก็บเลขใบงานไว้ในเครื่องเจ้าของร้าน ให้กดเข้าไปดูหน้าไรเดอร์ได้ภายหลัง
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

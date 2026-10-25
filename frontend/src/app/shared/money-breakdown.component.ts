import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

// ค่าคงที่ต้องตรงกับ CONFIG ใน services/optimizer.ts ที่ backend
const C = { pricePerBox: 65, costPerBox: 40, baseFee: 15, perKmPerBox: 2 };
const r2 = (n: number) => Math.round(n * 100) / 100;

@Component({
  selector: 'app-money-breakdown',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (data) {
      <div class="mt-4">
        <h2 class="text-[17px] font-bold mb-2">รายละเอียดการคำนวณเงิน</h2>
        <p class="text-sm text-mute my-3.5">
          ราคาขาย {{ C.pricePerBox }} ฿/กล่อง · ต้นทุนอาหาร {{ C.costPerBox }} ฿/กล่อง ·
          ค่าจ้างไรเดอร์ = {{ C.baseFee }} ฿ + {{ C.perKmPerBox }} ฿ × กล่อง × กม.
        </p>

        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th>ไรเดอร์</th><th class="text-right">กล่อง</th><th class="text-right">กม.</th>
              <th class="text-right">รายได้ (กล่อง × {{ C.pricePerBox }})</th>
              <th class="text-right">ต้นทุนอาหาร (กล่อง × {{ C.costPerBox }})</th>
              <th>ค่าจ้างไรเดอร์</th>
              <th class="text-right">กำไรเที่ยวนี้</th>
            </tr>
          </thead>
          <tbody>
            @for (r of data.riders; track r.riderNo) {
              <tr>
                <td>คนที่ {{ r.riderNo }}</td>
                <td class="text-right">{{ r.boxes }}</td>
                <td class="text-right">{{ r.km }}</td>
                <td class="text-right">{{ money(r.boxes * C.pricePerBox) }}</td>
                <td class="text-right">{{ money(r.boxes * C.costPerBox) }}</td>
                <td>{{ C.baseFee }} + {{ C.perKmPerBox }} × {{ r.boxes }} × {{ r.km }} = <b>{{ money(r.fee) }}</b></td>
                <td class="text-right" [class.text-bad]="profitOf(r) < 0">{{ money(profitOf(r)) }}</td>
              </tr>
            }
            <tr>
              <td><b>รวม</b></td>
              <td class="text-right"><b>{{ t.boxes }}</b></td>
              <td class="text-right"><b>{{ t.km }}</b></td>
              <td class="text-right"><b>{{ money(t.revenue) }}</b></td>
              <td class="text-right"><b>{{ money(t.food) }}</b></td>
              <td><b>{{ money(t.fee) }}</b></td>
              <td class="text-right"><b [class.text-bad]="t.profit < 0">{{ money(t.profit) }}</b></td>
            </tr>
          </tbody>
        </table>
        </div>

        <div class="bg-brand-soft rounded-[10px] p-3 mt-2.5 leading-[1.9]">
          <div>รายได้รวม = {{ t.boxes }} กล่อง × {{ C.pricePerBox }} = <b>{{ money(t.revenue) }}</b></div>
          <div>ต้นทุนอาหารรวม = {{ t.boxes }} กล่อง × {{ C.costPerBox }} = <b>{{ money(t.food) }}</b></div>
          <div>ค่าจ้างไรเดอร์รวม = {{ money(t.fee) }}</div>
          <div>กำไรสุทธิ = {{ money(t.revenue) }} − {{ money(t.food) }} − {{ money(t.fee) }} = <b [class.text-bad]="t.profit < 0">{{ money(t.profit) }}</b></div>
          <div class="text-sm text-mute">ยอดจากระบบ: กำไร {{ money(data.summary.profit) }} · เวลาออกจากร้าน 11:30 · ต้องส่งให้เสร็จก่อน 12:30</div>
        </div>
      </div>
    }
  `,
})
export class MoneyBreakdownComponent {
  @Input() data: any = null;
  C = C;
  money = (n: number) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ฿';

  profitOf(r: any) {
    return r2(r.boxes * C.pricePerBox - r.boxes * C.costPerBox - r.fee);
  }

  get t() {
    const rs: any[] = this.data?.riders ?? [];
    const boxes = rs.reduce((s, r) => s + r.boxes, 0);
    const km = r2(rs.reduce((s, r) => s + r.km, 0));
    const fee = r2(rs.reduce((s, r) => s + r.fee, 0));
    const revenue = boxes * C.pricePerBox;
    const food = boxes * C.costPerBox;
    return { boxes, km, fee, revenue, food, profit: r2(revenue - food - fee) };
  }
}

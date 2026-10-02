import express from "express";
import { randomInt } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import { conn } from "../dbconnect";
import { Stop, Strategy, STRATEGY_LABELS, buildPlan } from "../services/optimizer";

export const router = express.Router();

const validDate = (d: unknown): d is string =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

const STRATEGIES = Object.keys(STRATEGY_LABELS) as Strategy[];

async function loadStops(date: string): Promise<Stop[]> {
  const [rows] = await conn.query(
    `SELECT o.id, o.boxes, c.firstname, c.lastname, c.phone, c.address, c.lat, c.lng
     FROM orders o JOIN customer c ON c.id = o.customer_id
     WHERE o.order_date = ?`,
    [date]
  );
  return (rows as any[]).map((r) => ({
    orderId: r.id,
    name: r.firstname + " " + r.lastname,
    phone: r.phone,
    address: r.address,
    boxes: r.boxes,
    lat: r.lat,
    lng: r.lng,
  }));
}

async function newJobCode(db: PoolConnection): Promise<string> {
  for (;;) {
    const code = String(randomInt(100000, 1000000));
    const [rows] = await db.query("SELECT 1 FROM job WHERE code = ?", [code]);
    if ((rows as any[]).length === 0) return code;
  }
}

router.post("/optimize", async (req, res) => {
  try {
    const date = req.body?.date;
    if (!validDate(date)) {
      res.status(400).json({ message: "date=YYYY-MM-DD is required" });
      return;
    }
    const seed = req.body?.seed ?? randomInt(1, 2_000_000_000);
    if (!Number.isInteger(seed)) {
      res.status(400).json({ message: "seed must be an integer" });
      return;
    }
    const stops = await loadStops(date);
    const options = STRATEGIES.map((strategy) => ({
      strategy,
      label: STRATEGY_LABELS[strategy],
      ...buildPlan(stops, strategy, seed),
    }));
    res.json({ date, seed, options });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/plan", async (req, res) => {
  let db: PoolConnection | undefined;
  try {
    const date = req.body?.date;
    const { strategy, seed } = req.body ?? {};
    if (!validDate(date)) {
      res.status(400).json({ message: "date=YYYY-MM-DD is required" });
      return;
    }
    if (!STRATEGIES.includes(strategy) || !Number.isInteger(seed)) {
      res.status(400).json({ message: "strategy and seed are required" });
      return;
    }
    const stops = await loadStops(date);
    if (stops.length === 0) {
      res.status(400).json({ message: "No orders on this date" });
      return;
    }
    const plan = buildPlan(stops, strategy, seed);

    db = await conn.getConnection();
    await db.beginTransaction();
    const [planResult] = await db.query(
      "INSERT INTO plan (plan_date, profit, total_km, rider_cost) VALUES (?, ?, ?, ?)",
      [date, plan.summary.profit, plan.summary.totalKm, plan.summary.riderCost]
    );
    const planId = (planResult as any).insertId;

    const riders = [];
    for (const r of plan.riders) {
      const code = await newJobCode(db);
      const [jobResult] = await db.query(
        "INSERT INTO job (plan_id, code, rider_no, color, boxes, km, fee, finish_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [planId, code, r.riderNo, r.color, r.boxes, r.km, r.fee, r.finishTime]
      );
      const jobId = (jobResult as any).insertId;
      for (const [i, s] of r.stops.entries()) {
        await db.query(
          `INSERT INTO job_stop (job_id, seq, order_id, customer_name, phone, address, lat, lng, boxes, eta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [jobId, i + 1, s.orderId, s.name, s.phone, s.address, s.lat, s.lng, s.boxes, r.arrivals[i] ?? ""]
        );
      }
      riders.push({ ...r, code });
    }
    await db.commit();
    res.status(201).json({ planId, date, strategy, seed, summary: plan.summary, riders });
  } catch (error) {
    await db?.rollback();
    res.status(500).json({ error: "Internal server error" });
  } finally {
    db?.release();
  }
});
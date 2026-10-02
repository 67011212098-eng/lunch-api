import express from "express";
import { conn } from "../dbconnect";
import { OrderPostRequest } from "../model/order";
import { simulateOrders } from "../services/simulate";

export const router = express.Router();

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const validBoxes = (b: unknown) => Number.isInteger(b) && (b as number) >= 1 && (b as number) <= 3;
const validDate = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

router.get("/", async (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : today();
    if (!validDate(date)) {
      res.status(400).json({ message: "date must be YYYY-MM-DD" });
      return;
    }
    const [rows] = await conn.query(
      `SELECT o.id, o.customer_id, o.boxes, o.order_date,
              c.firstname, c.lastname, c.phone, c.address, c.lat, c.lng
       FROM orders o JOIN customer c ON c.id = o.customer_id
       WHERE o.order_date = ?
       ORDER BY o.id`,
      [date]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const o: OrderPostRequest = req.body;
    const date = o?.date ?? today();
    if (!o?.customerId || !validBoxes(o.boxes) || !validDate(date)) {
      res.status(400).json({ message: "customerId and boxes (1-3) are required, date must be YYYY-MM-DD" });
      return;
    }
    const [cust] = await conn.query("SELECT id FROM customer WHERE id = ?", [o.customerId]);
    if ((cust as any[]).length === 0) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }
    const [result] = await conn.query(
      "INSERT INTO orders (customer_id, boxes, order_date) VALUES (?, ?, ?)",
      [o.customerId, o.boxes, date]
    );
    const r = result as any;
    res.status(201).json({ affected_row: r.affectedRows, last_idx: r.insertId });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!validBoxes(req.body?.boxes)) {
      res.status(400).json({ message: "boxes must be an integer 1-3" });
      return;
    }
    const [result] = await conn.query("UPDATE orders SET boxes = ? WHERE id = ?", [
      req.body.boxes,
      req.params.id,
    ]);
    const r = result as any;
    if (r.affectedRows === 0) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.status(200).json({ affected_row: r.affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [req.params.id]);
    const r = result as any;
    if (r.affectedRows === 0) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.status(200).json({ affected_row: r.affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ใช้ล้างออเดอร์จำลองตอนทดสอบ
router.delete("/", async (req, res) => {
  try {
    const date = req.query.date;
    if (!validDate(date)) {
      res.status(400).json({ message: "date=YYYY-MM-DD is required" });
      return;
    }
    const [result] = await conn.query("DELETE FROM orders WHERE order_date = ?", [date]);
    res.status(200).json({ affected_row: (result as any).affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ไม่ระบุ count = สุ่ม 20-30 รายการ
router.post("/simulate", async (req, res) => {
  try {
    const date = req.body?.date ?? today();
    if (!validDate(date)) {
      res.status(400).json({ message: "date must be YYYY-MM-DD" });
      return;
    }
    const wanted = Number(req.body?.count) || Math.floor(Math.random() * 11) + 20;
    const count = Math.min(Math.max(wanted, 1), 60);
    res.status(201).json(await simulateOrders(date, count));
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
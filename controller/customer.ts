import express from "express";
import { conn } from "../dbconnect";
import { CustomerPostRequest } from "../model/customer";

export const router = express.Router();

router.get("/", async (req, res) => {
  try {
    if (req.query.name) {
      const keyword = "%" + req.query.name + "%";
      const [rows] = await conn.query(
        "SELECT * FROM customer WHERE firstname LIKE ? OR lastname LIKE ?",
        [keyword, keyword]
      );
      res.json(rows);
    } else {
      const [rows] = await conn.query("SELECT * FROM customer");
      res.json(rows);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const c: CustomerPostRequest = req.body;
    if (!c?.firstname || !c?.lastname || !c?.phone || c.lat === undefined || c.lng === undefined) {
      res.status(400).json({ message: "firstname, lastname, phone, lat, lng are required" });
      return;
    }
    const [result] = await conn.query(
      "INSERT INTO customer (firstname, lastname, phone, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)",
      [c.firstname, c.lastname, c.phone, c.address ?? "", c.lat, c.lng]
    );
    const r = result as any;
    res.status(201).json({ affected_row: r.affectedRows, last_idx: r.insertId });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "phone already exists" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM customer WHERE id = ?", [req.params.id]);
    const found = rows as any[];
    if (found.length === 0) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }
    res.json(found[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await conn.query("SELECT * FROM customer WHERE id = ?", [id]);
    const found = rows as any[];
    if (found.length === 0) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    const updated = { ...found[0], ...req.body };

    const [result] = await conn.query(
      "UPDATE customer SET firstname = ?, lastname = ?, phone = ?, address = ?, lat = ?, lng = ? WHERE id = ?",
      [updated.firstname, updated.lastname, updated.phone, updated.address, updated.lat, updated.lng, id]
    );
    const r = result as any;
    res.status(200).json({ affected_row: r.affectedRows });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ message: "phone already exists" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});
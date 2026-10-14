import express from "express";
import path from "path";

export const router = express.Router();

// GET / - เช็กว่าเซิร์ฟเวอร์ทำงานอยู่ (เบราว์เซอร์จะได้หน้าเว็บของระบบ ส่วน Bruno/curl ได้ข้อความตามเดิม)
router.get("/", (req, res) => {
  if (req.headers.accept?.includes("text/html")) {
    res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
    return;
  }
  res.send("Get in index.ts");
});

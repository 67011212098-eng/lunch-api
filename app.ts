import express from "express";
import cors from "cors";
import path from "path";
import { router as index } from "./controller/index";
import { router as customer } from "./controller/customer";
import { router as order } from "./controller/order";
import { router as route } from "./controller/route";
import { router as job } from "./controller/job";

export const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.text());
app.use(express.json());

// ส่งหน้าเว็บให้เบราว์เซอร์ที่เปิดลิงก์ตามคู่มือ
const pageLinks = [/^\/$/, /^\/customer(\/(nearby|\d+))?\/?$/, /^\/order(\/(nearby|simulate|\d+))?\/?$/, /^\/route\/(optimize|plan)(\/\d+)?\/?$/, /^\/job\/[^/]+\/?$/];
app.use((req, res, next) => {
  if (req.method === "GET" && req.headers.accept?.includes("text/html") && pageLinks.some((re) => re.test(req.path))) {
    res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
    return;
  }
  next();
});

app.use("/", index);
app.use("/customer", customer);
app.use("/order", order);
app.use("/route", route);
app.use("/job", job);
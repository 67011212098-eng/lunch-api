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


const web = path.join(process.cwd(), "frontend", "build");
const pageLinks = [/^\/$/, /^\/customer(\/(nearby|\d+))?\/?$/, /^\/order(\/(nearby|simulate|\d+))?\/?$/, /^\/route\/(optimize|plan)(\/\d+)?\/?$/, /^\/job\/[^/]+\/?$/, /^\/(login|rider)\/?$/];
app.use((req, res, next) => {
  if (req.method === "GET" && req.headers.accept?.includes("text/html") && pageLinks.some((re) => re.test(req.path))) {
    res.sendFile(path.join(web, "index.html"));
    return;
  }
  next();
});
app.use(express.static(web, { index: false }));

app.use("/", index);
app.use("/customer", customer);
app.use("/order", order);
app.use("/route", route);
app.use("/job", job);
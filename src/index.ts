import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import authRouter from "./routes/auth.routes";
import fazendasRouter from "./routes/fazendas.routes";
import talhoesRouter from "./routes/talhoes.routes";
import lotesRouter from "./routes/lotes.routes";
import vendasRouter from "./routes/vendas.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import swaggerRouter from "./swagger";

const app = new Hono();

// ─── Middlewares Globais ───────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Autenticação JWT em todas as rotas /api/*
app.use("/api/*", authMiddleware);

// ─── Ping (Health Check) ──────────────────────────────────────────────────────
app.get("/ping", (c) => {
  return c.json({
    status: "ok",
    service: "Fazenda Pedra Negra API",
    timestamp: new Date().toISOString(),
  });
});

// ─── Rotas da API ─────────────────────────────────────────────────────────────
app.route("/api/auth", authRouter);
app.route("/api/fazendas", fazendasRouter);   // GET/POST/PUT/DELETE /api/fazendas
app.route("/api", talhoesRouter);             // /api/fazendas/:id/talhoes | /api/talhoes/:id
app.route("/api", lotesRouter);               // /api/fazendas/:id/lotes  | /api/lotes/:id
app.route("/api", vendasRouter);              // /api/fazendas/:id/vendas | /api/vendas/:id

// ─── Documentação (Swagger UI) ────────────────────────────────────────────────
app.route("/", swaggerRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.notFound((c) =>
  c.json({ error: "Rota não encontrada", path: c.req.path }, 404)
);

// ─── Erro 500 ─────────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("❌ Erro na requisição:", err);
  return c.json({ error: "Erro interno do servidor", message: err.message }, 500);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT || 3001);
console.log(`🚀 API Fazenda Pedra Negra em execução na porta ${port}...`);
console.log(`📚 Swagger UI: http://localhost:${port}/doc`);
console.log(`🏓 Ping:       http://localhost:${port}/ping`);

export default {
  port,
  fetch: app.fetch,
};

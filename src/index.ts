import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import authRouter from "./routes/auth.routes";
import fazendasRouter from "./routes/fazendas.routes";
import talhoesRouter from "./routes/talhoes.routes";
import lotesRouter from "./routes/lotes.routes";
import vendasRouter from "./routes/vendas.routes";
import amostrasRouter from "./routes/amostras.routes";
import integracoesRouter from "./routes/integracoes.routes";
import cronRouter from "./routes/cron.routes";
import dashboardRouter from "./routes/dashboard.routes";
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

// Autenticação JWT em todas as rotas /api/* (exceto crons)
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/crons")) {
    return next();
  }
  return authMiddleware(c, next);
});

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
app.route("/api", amostrasRouter);            // /api/fazendas/:id/amostras | /api/amostras/:id
app.route("/api/integracoes", integracoesRouter); // /api/integracoes/**
app.route("/api", dashboardRouter);           // /api/fazendas/:id/dashboard
app.route("/api/crons", cronRouter);          // /api/crons/**

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

// ─── Graceful Shutdown (Evita prender a porta no debugger) ────────────────────
const shutdown = () => {
  console.log("🛑 Encerrando o servidor e liberando a porta...");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // Aumenta o tempo limite para operações muito longas (ex: Cron)
};

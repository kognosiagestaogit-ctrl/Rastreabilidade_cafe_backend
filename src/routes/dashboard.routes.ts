import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { lotesTable, vendasTable, amostrasTable } from "../db/schema";

const dashboardRouter = new Hono();

// ── GET /api/fazendas/:fazendaId/dashboard ──────────────────────────────────
// Retorna os indicadores consolidados do painel (Dashboard)
dashboardRouter.get("/fazendas/:fazendaId/dashboard", async (c) => {
  const fazendaId = c.req.param("fazendaId");

  try {
    // 1. Total Sacas Produzidas (busca em lotesTable.numero_sacas)
    const [lotesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${lotesTable.numero_sacas}), 0)`,
      })
      .from(lotesTable)
      .where(eq(lotesTable.fazenda_id, fazendaId));

    const total_sacas_produzidas = Number(lotesResult?.total || 0);

    // 2. Total Sacas Vendidas (busca em vendasTable.sacas_vendidas)
    const [vendasResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${vendasTable.sacas_vendidas}), 0)`,
      })
      .from(vendasTable)
      .where(eq(vendasTable.fazenda_id, fazendaId));

    const total_sacas_vendidas = Number(vendasResult?.total || 0);

    // 3 e 4. Total Faturado e Total a Receber (busca em amostrasTable)
    const [amostrasResult] = await db
      .select({
        faturado: sql<number>`COALESCE(SUM(${amostrasTable.valor_recebido}), 0)`,
        aReceber: sql<number>`COALESCE(SUM(${amostrasTable.a_receber_previsto}), 0)`,
      })
      .from(amostrasTable)
      .where(eq(amostrasTable.fazenda_id, fazendaId));

    const total_faturado = Number(amostrasResult?.faturado || 0);
    const total_a_receber = Number(amostrasResult?.aReceber || 0);

    return c.json({
      total_sacas_produzidas,
      total_sacas_vendidas,
      total_faturado,
      total_a_receber,
    });
  } catch (err: any) {
    console.error("Erro ao carregar dashboard:", err);
    return c.json({ error: "Erro ao carregar indicadores do dashboard" }, 500);
  }
});

export default dashboardRouter;

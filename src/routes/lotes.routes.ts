import { Hono } from "hono";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { lotesTable, vendasTable } from "../db/schema";
import { randomUUID } from "crypto";
import type { LoteStatus } from "../types";

// Montado em /api pelo index.ts
const lotesRouter = new Hono();

const LOTE_STATUS = [
  "EM_COLHEITA",
  "NO_TERREIRO",
  "NO_SECADOR",
  "NA_TULHA",
  "BENEFICIADO",
  "ENVIADO_COOPERATIVA",
] as const;

const loteSchema = z.object({
  fazenda_id: z.string().min(1),
  talhao_ids: z.array(z.string()).optional().default([]),
  safra: z.number().int().min(2000).max(2100),
  numero_lote_fazenda: z.string().trim().min(1).max(50),
  lote_colheita: z.string().trim().max(50).optional().nullable(),
  tipo_cafe: z.string().trim().max(60).optional().nullable(),
  colheita_tipo: z.enum(["MANUAL", "MECANICA"]).optional().nullable(),
  data_colheita_inicio: z.string().optional().nullable(),
  data_colheita_fim: z.string().optional().nullable(),
  status: z.enum(LOTE_STATUS).optional().default("EM_COLHEITA"),
  data_entrada_terreiro: z.string().optional().nullable(),
  data_saida_terreiro: z.string().optional().nullable(),
  data_entrada_secador: z.string().optional().nullable(),
  data_saida_secador: z.string().optional().nullable(),
  umidade: z.number().optional().nullable(),
  numero_tulha: z.string().trim().max(50).optional().nullable(),
  data_beneficio: z.string().optional().nullable(),
  data_envio_cooperativa: z.string().optional().nullable(),
  numero_sacas: z.number().optional().nullable(),
  numero_lote_cooperativa: z.string().trim().max(50).optional().nullable(),
  amostra: z.string().trim().max(100).optional().nullable(),
  nf_remessa_cooperativa: z.string().trim().max(50).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

// GET /api/fazendas/:fazendaId/lotes
lotesRouter.get("/fazendas/:fazendaId/lotes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const lotes = await db
      .select()
      .from(lotesTable)
      .where(eq(lotesTable.fazenda_id, fazendaId))
      .orderBy(desc(lotesTable.created_at));

    const vendasList = await db
      .select({ lote_id: vendasTable.lote_id })
      .from(vendasTable)
      .where(eq(vendasTable.fazenda_id, fazendaId));

    const vendasCountByLote = vendasList.reduce((acc, v) => {
      if (v.lote_id) {
        acc[v.lote_id] = (acc[v.lote_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const rowsWithVendasCount = lotes.map(lote => ({
      ...lote,
      quantidade_vendas: vendasCountByLote[lote.id] || 0
    }));

    return c.json(rowsWithVendasCount);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar lotes", message: err.message }, 500);
  }
});

// GET /api/lotes/:id
lotesRouter.get("/lotes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [row] = await db.select().from(lotesTable).where(eq(lotesTable.id, id)).limit(1);
    if (!row) return c.json({ error: "Lote não encontrado" }, 404);

    const vendasDoLote = await db
      .select({ id: vendasTable.id })
      .from(vendasTable)
      .where(eq(vendasTable.lote_id, id));

    return c.json({ ...row, quantidade_vendas: vendasDoLote.length });
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar lote", message: err.message }, 500);
  }
});

// POST /api/lotes
lotesRouter.post("/lotes", async (c) => {
  try {
    const body = await c.req.json();
    const data = loteSchema.parse(body);
    const now = new Date().toISOString();
    const novo = {
      id: randomUUID(),
      fazenda_id: data.fazenda_id,
      talhao_ids: data.talhao_ids ?? [],
      safra: data.safra,
      numero_lote_fazenda: data.numero_lote_fazenda,
      lote_colheita: data.lote_colheita ?? null,
      tipo_cafe: data.tipo_cafe ?? null,
      colheita_tipo: data.colheita_tipo ?? null,
      data_colheita_inicio: data.data_colheita_inicio ?? null,
      data_colheita_fim: data.data_colheita_fim ?? null,
      status: (data.status ?? "EM_COLHEITA") as LoteStatus,
      data_entrada_terreiro: data.data_entrada_terreiro ?? null,
      data_saida_terreiro: data.data_saida_terreiro ?? null,
      data_entrada_secador: data.data_entrada_secador ?? null,
      data_saida_secador: data.data_saida_secador ?? null,
      umidade: data.umidade ?? null,
      numero_tulha: data.numero_tulha ?? null,
      data_beneficio: data.data_beneficio ?? null,
      data_envio_cooperativa: data.data_envio_cooperativa ?? null,
      numero_sacas: data.numero_sacas ?? null,
      numero_lote_cooperativa: data.numero_lote_cooperativa ?? null,
      amostra: data.amostra ?? null,
      nf_remessa_cooperativa: data.nf_remessa_cooperativa ?? null,
      observacoes: data.observacoes ?? null,
      created_at: now,
      updated_at: now,
    };
    
    const [created] = await db.insert(lotesTable).values(novo).returning();
    return c.json(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar lote", message: err.message }, 500);
  }
});

// PUT /api/lotes/:id
lotesRouter.put("/lotes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const data = loteSchema.partial().parse(body);
    
    const [updated] = await db
      .update(lotesTable)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(lotesTable.id, id))
      .returning();
      
    if (!updated) return c.json({ error: "Lote não encontrado" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar lote", message: err.message }, 500);
  }
});

// DELETE /api/lotes/:id
lotesRouter.delete("/lotes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db.delete(lotesTable).where(eq(lotesTable.id, id)).returning();
    if (!deleted) return c.json({ error: "Lote não encontrado" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao remover lote", message: err.message }, 500);
  }
});

export default lotesRouter;

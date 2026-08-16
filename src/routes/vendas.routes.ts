import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { vendasTable } from "../db/schema";
import { randomUUID } from "crypto";

// Montado em /api pelo index.ts
const vendasRouter = new Hono();

const vendaSchema = z.object({
  fazenda_id: z.string().min(1),
  lote_id: z.string().optional().nullable(),
  numero_lote_cooperativa: z.string().trim().max(50).optional().nullable(),
  padrao: z.string().trim().max(100).optional().nullable(),
  quebra: z.number().optional().nullable(),
  peneira: z.string().trim().max(20).optional().nullable(),
  amostra: z.string().trim().max(50).optional().nullable(),
  cliente: z.string().trim().max(200).optional().nullable(),
  nf_venda: z.string().trim().max(50).optional().nullable(),
  sacas_vendidas: z.number().min(0),
  tipo_venda: z.enum(["CPR", "TERMO", "FISICA"]).optional().nullable(),
  data_venda: z.string().optional().nullable(),
  vl_bruto: z.number().optional().nullable(),
  vl_liquido: z.number().optional().nullable(),
  a_receber_previsto: z.number().optional().nullable(),
  valor_recebido: z.number().optional().nullable(),
  data_recebimento: z.string().optional().nullable(),
  premio_rainforest: z.number().optional().nullable(),
  anuncio_venda: z.string().trim().max(50).optional().nullable(),
  nf_premio_rainforest: z.string().trim().max(50).optional().nullable(),
  premio_liquido_funrural: z.number().optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  cooperado: z.string().trim().max(50).optional().nullable(),
  data_envio_armazem: z.string().optional().nullable(),
  sacas_do_lote: z.number().optional().nullable(),
  nr_remessa_cooperativa: z.string().trim().max(50).optional().nullable(),
  lotes_agrupados: z.string().trim().max(200).optional().nullable(),
  descontos: z.number().optional().nullable(),
  conta_corrente: z.string().trim().max(200).optional().nullable(),
  is_ds: z.number().int().optional().nullable(),
  data_recebimento_premio: z.string().optional().nullable(),
  status: z.string().trim().max(50).optional().nullable(),
});

// GET /api/fazendas/:fazendaId/vendas
vendasRouter.get("/fazendas/:fazendaId/vendas", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const rows = await db
      .select()
      .from(vendasTable)
      .where(eq(vendasTable.fazenda_id, fazendaId))
      .orderBy(desc(vendasTable.created_at));
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar vendas", message: err.message }, 500);
  }
});
// GET /api/fazendas/:fazendaId/vendas/disponiveis
// Lista vendas que ainda não estão vinculadas a nenhuma amostra
vendasRouter.get("/fazendas/:fazendaId/vendas/disponiveis", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const rows = await db
      .select({
        id: vendasTable.id,
        numero_lote_cooperativa: vendasTable.numero_lote_cooperativa,
        amostra: vendasTable.amostra,
        data_venda: vendasTable.data_venda,
        sacas_vendidas: vendasTable.sacas_vendidas,
        tipo_venda: vendasTable.tipo_venda,
        vl_liquido: vendasTable.vl_liquido,
      })
      .from(vendasTable)
      .where(
        and(
          eq(vendasTable.fazenda_id, fazendaId),
          isNull(vendasTable.amostra_id)
        )
      )
      .orderBy(desc(vendasTable.created_at));
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar vendas disponíveis", message: err.message }, 500);
  }
});

// GET /api/vendas/:id
vendasRouter.get("/vendas/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [row] = await db.select().from(vendasTable).where(eq(vendasTable.id, id)).limit(1);
    if (!row) return c.json({ error: "Venda não encontrada" }, 404);
    return c.json(row);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar venda", message: err.message }, 500);
  }
});

// POST /api/vendas
vendasRouter.post("/vendas", async (c) => {
  try {
    const body = await c.req.json();
    const data = vendaSchema.parse(body);
    const now = new Date().toISOString();
    const nova = {
      id: randomUUID(),
      ...data,
      lote_id: data.lote_id ?? null,
      created_at: now,
      updated_at: now,
    };
    
    const [created] = await db.insert(vendasTable).values(nova).returning();
    return c.json(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar venda", message: err.message }, 500);
  }
});

// PUT /api/vendas/:id
vendasRouter.put("/vendas/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const data = vendaSchema.partial().parse(body);
    
    const [updated] = await db
      .update(vendasTable)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(vendasTable.id, id))
      .returning();
      
    if (!updated) return c.json({ error: "Venda não encontrada" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar venda", message: err.message }, 500);
  }
});

// DELETE /api/vendas/:id
vendasRouter.delete("/vendas/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db.delete(vendasTable).where(eq(vendasTable.id, id)).returning();
    if (!deleted) return c.json({ error: "Venda não encontrada" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao remover venda", message: err.message }, 500);
  }
});

export default vendasRouter;

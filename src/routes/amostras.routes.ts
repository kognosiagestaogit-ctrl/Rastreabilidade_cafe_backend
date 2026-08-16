import { Hono } from "hono";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { amostrasTable, vendasTable } from "../db/schema";
import { randomUUID } from "crypto";

const amostrasRouter = new Hono();

const amostraSchema = z.object({
  fazenda_id: z.string().min(1),
  codigo_amostra: z.string().trim().min(1),
  total_sacas: z.number().optional().default(0),
  descontos: z.number().optional().default(0),
  observacoes: z.string().trim().optional().nullable(),
  a_receber_previsto: z.number().optional().nullable(),
  valor_recebido: z.number().optional().nullable(),
  data_recebimento: z.string().optional().nullable(),
  conta_corrente: z.string().trim().optional().nullable(),
  is_ds: z.number().optional().default(0),
  premio_rainforest: z.number().optional().default(0),
  anuncio_venda: z.string().trim().optional().nullable(),
  v_funrural: z.number().optional().default(0),
});

// GET /api/fazendas/:fazendaId/amostras
amostrasRouter.get("/fazendas/:fazendaId/amostras", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const amostras = await db
      .select()
      .from(amostrasTable)
      .where(eq(amostrasTable.fazenda_id, fazendaId))
      .orderBy(desc(amostrasTable.created_at));

    // Buscar vendas para aninhar (opcional, dependendo do volume)
    const vendas = await db
      .select()
      .from(vendasTable)
      .where(eq(vendasTable.fazenda_id, fazendaId));

    const vendasPorAmostra = vendas.reduce((acc, venda) => {
      if (venda.amostra_id) {
        if (!acc[venda.amostra_id]) acc[venda.amostra_id] = [];
        acc[venda.amostra_id].push(venda);
      }
      return acc;
    }, {} as Record<string, typeof vendas>);

    const rowsWithVendas = amostras.map(amostra => ({
      ...amostra,
      vendas: vendasPorAmostra[amostra.id] || [],
    }));

    return c.json(rowsWithVendas);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar amostras", message: err.message }, 500);
  }
});

// GET /api/amostras/:id
amostrasRouter.get("/amostras/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [amostra] = await db
      .select()
      .from(amostrasTable)
      .where(eq(amostrasTable.id, id))
      .limit(1);

    if (!amostra) return c.json({ error: "Amostra não encontrada" }, 404);

    const vendas = await db
      .select()
      .from(vendasTable)
      .where(eq(vendasTable.amostra_id, id));

    return c.json({ ...amostra, vendas });
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar amostra", message: err.message }, 500);
  }
});

// POST /api/amostras
amostrasRouter.post("/amostras", async (c) => {
  try {
    const body = await c.req.json();
    const data = amostraSchema.parse(body);
    const now = new Date().toISOString();

    const novaAmostra = {
      id: randomUUID(),
      fazenda_id: data.fazenda_id,
      codigo_amostra: data.codigo_amostra,
      total_sacas: data.total_sacas ?? 0,
      descontos: data.descontos ?? 0,
      observacoes: data.observacoes ?? null,
      a_receber_previsto: data.a_receber_previsto ?? null,
      valor_recebido: data.valor_recebido ?? null,
      data_recebimento: data.data_recebimento ?? null,
      conta_corrente: data.conta_corrente ?? null,
      is_ds: data.is_ds ?? 0,
      premio_rainforest: data.premio_rainforest ?? 0,
      anuncio_venda: data.anuncio_venda ?? null,
      v_funrural: data.v_funrural ?? 0,
      created_at: now,
      updated_at: now,
    };

    const [created] = await db.insert(amostrasTable).values(novaAmostra).returning();
    return c.json(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar amostra", message: err.message }, 500);
  }
});

// PUT /api/amostras/:id
amostrasRouter.put("/amostras/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const data = amostraSchema.partial().parse(body);

    const [updated] = await db
      .update(amostrasTable)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(amostrasTable.id, id))
      .returning();

    if (!updated) return c.json({ error: "Amostra não encontrada" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar amostra", message: err.message }, 500);
  }
});

// DELETE /api/amostras/:id
amostrasRouter.delete("/amostras/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db.delete(amostrasTable).where(eq(amostrasTable.id, id)).returning();
    if (!deleted) return c.json({ error: "Amostra não encontrada" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao deletar amostra", message: err.message }, 500);
  }
});

export default amostrasRouter;

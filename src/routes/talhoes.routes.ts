import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { talhoesTable } from "../db/schema";
import { randomUUID } from "crypto";

// Montado em /api pelo index.ts (rotas: /api/fazendas/:id/talhoes e /api/talhoes/:id)
const talhoesRouter = new Hono();

const talhaoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(120),
  area_hectares: z.number().positive().optional().nullable(),
  variedade: z.string().trim().max(120).optional().nullable(),
});

// GET /api/fazendas/:fazendaId/talhoes
talhoesRouter.get("/fazendas/:fazendaId/talhoes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const rows = await db
      .select()
      .from(talhoesTable)
      .where(eq(talhoesTable.fazenda_id, fazendaId))
      .orderBy(talhoesTable.nome);
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar talhões", message: err.message }, 500);
  }
});

// POST /api/fazendas/:fazendaId/talhoes
talhoesRouter.post("/fazendas/:fazendaId/talhoes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const body = await c.req.json();
    const data = talhaoSchema.parse(body);
    const novo = {
      id: randomUUID(),
      fazenda_id: fazendaId,
      nome: data.nome,
      area_hectares: data.area_hectares ?? null,
      variedade: data.variedade ?? null,
      created_at: new Date().toISOString(),
    };
    
    const [created] = await db.insert(talhoesTable).values(novo).returning();
    return c.json(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar talhão", message: err.message }, 500);
  }
});

// DELETE /api/talhoes/:id
talhoesRouter.delete("/talhoes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db.delete(talhoesTable).where(eq(talhoesTable.id, id)).returning();
    if (!deleted) return c.json({ error: "Talhão não encontrado" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao remover talhão", message: err.message }, 500);
  }
});

export default talhoesRouter;

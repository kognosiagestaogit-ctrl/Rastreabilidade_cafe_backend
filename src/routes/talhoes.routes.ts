import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { talhoesTable } from "../db/schema";
import { randomUUID } from "crypto";
import type { Talhao } from "../types";

// Montado em /api pelo index.ts (rotas: /api/fazendas/:id/talhoes e /api/talhoes/:id)
const talhoesRouter = new Hono();

// Fallback em memória
let memTalhoes: Talhao[] = [];

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
  } catch {
    console.warn("⚠️ DB indisponível — talhões em memória");
    return c.json(memTalhoes.filter((t) => t.fazenda_id === fazendaId));
  }
});

// POST /api/fazendas/:fazendaId/talhoes
talhoesRouter.post("/fazendas/:fazendaId/talhoes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const body = await c.req.json();
    const data = talhaoSchema.parse(body);
    const novo: Talhao = {
      id: randomUUID(),
      fazenda_id: fazendaId,
      nome: data.nome,
      area_hectares: data.area_hectares ?? null,
      variedade: data.variedade ?? null,
      created_at: new Date().toISOString(),
    };
    try {
      const [created] = await db.insert(talhoesTable).values(novo).returning();
      return c.json(created, 201);
    } catch {
      console.warn("⚠️ DB indisponível — salvando talhão em memória");
      memTalhoes.push(novo);
      return c.json(novo, 201);
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar talhão", message: err.message }, 500);
  }
});

// DELETE /api/talhoes/:id
talhoesRouter.delete("/talhoes/:id", async (c) => {
  const id = c.req.param("id");
  try {
    try {
      const [deleted] = await db.delete(talhoesTable).where(eq(talhoesTable.id, id)).returning();
      if (!deleted) return c.json({ error: "Talhão não encontrado" }, 404);
      return c.json({ success: true });
    } catch {
      console.warn("⚠️ DB indisponível — removendo talhão em memória");
      const before = memTalhoes.length;
      memTalhoes = memTalhoes.filter((t) => t.id !== id);
      if (memTalhoes.length === before) return c.json({ error: "Talhão não encontrado" }, 404);
      return c.json({ success: true });
    }
  } catch (err: any) {
    return c.json({ error: "Erro ao remover talhão", message: err.message }, 500);
  }
});

export default talhoesRouter;

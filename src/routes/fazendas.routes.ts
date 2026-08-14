import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { fazendasTable } from "../db/schema";
import { randomUUID } from "crypto";

// Montado em /api/fazendas pelo index.ts
const fazendasRouter = new Hono();

const fazendaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(120),
  proprietario: z.string().trim().max(120).optional().nullable(),
  cooperado_iniciais: z.string().trim().max(20).optional().nullable(),
  localizacao: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  cor: z.string().trim().max(50).optional().nullable(),
});

// GET /api/fazendas
fazendasRouter.get("/", async (c) => {
  try {
    const rows = await db.select().from(fazendasTable).orderBy(fazendasTable.nome);
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar fazendas", message: err.message }, 500);
  }
});

// GET /api/fazendas/:id
fazendasRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [row] = await db.select().from(fazendasTable).where(eq(fazendasTable.id, id)).limit(1);
    if (!row) return c.json({ error: "Fazenda não encontrada" }, 404);
    return c.json(row);
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar fazenda", message: err.message }, 500);
  }
});

// POST /api/fazendas
fazendasRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = fazendaSchema.parse(body);
    const now = new Date().toISOString();
    const nova = {
      id: randomUUID(),
      nome: data.nome,
      proprietario: data.proprietario ?? null,
      cooperado_iniciais: data.cooperado_iniciais ?? null,
      localizacao: data.localizacao ?? null,
      observacoes: data.observacoes ?? null,
      cor: data.cor ?? null,
      created_at: now,
      updated_at: now,
    };
    
    const [created] = await db.insert(fazendasTable).values(nova).returning();
    return c.json(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar fazenda", message: err.message }, 500);
  }
});

// PUT /api/fazendas/:id
fazendasRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const data = fazendaSchema.partial().parse(body);
    
    const [updated] = await db
      .update(fazendasTable)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(fazendasTable.id, id))
      .returning();
      
    if (!updated) return c.json({ error: "Fazenda não encontrada" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar fazenda", message: err.message }, 500);
  }
});

// DELETE /api/fazendas/:id
fazendasRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db.delete(fazendasTable).where(eq(fazendasTable.id, id)).returning();
    if (!deleted) return c.json({ error: "Fazenda não encontrada" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao remover fazenda", message: err.message }, 500);
  }
});

export default fazendasRouter;

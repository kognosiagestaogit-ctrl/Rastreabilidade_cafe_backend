import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { fazendasTable } from "../db/schema";
import { randomUUID } from "crypto";
import type { Fazenda } from "../types";

// Montado em /api/fazendas pelo index.ts
const fazendasRouter = new Hono();

// ── Fallback em memória (sem banco) ───────────────────────────────────────────
let memFazendas: Fazenda[] = [
  {
    id: "demo-fazenda-1",
    nome: "Fazenda Pedra Negra (Demo)",
    proprietario: "Administrador",
    cooperado_iniciais: "FPN",
    localizacao: "Minas Gerais",
    observacoes: "Fazenda pré-cadastrada para visualização.",
    cor: "emerald",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
  } catch {
    console.warn("⚠️ DB indisponível — usando fallback em memória para fazendas");
    return c.json([...memFazendas].sort((a, b) => a.nome.localeCompare(b.nome)));
  }
});

// GET /api/fazendas/:id
fazendasRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [row] = await db.select().from(fazendasTable).where(eq(fazendasTable.id, id)).limit(1);
    if (!row) return c.json({ error: "Fazenda não encontrada" }, 404);
    return c.json(row);
  } catch {
    const row = memFazendas.find((f) => f.id === id);
    if (!row) return c.json({ error: "Fazenda não encontrada" }, 404);
    return c.json(row);
  }
});

// POST /api/fazendas
fazendasRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = fazendaSchema.parse(body);
    const now = new Date().toISOString();
    const nova: Fazenda = {
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
    try {
      const [created] = await db.insert(fazendasTable).values(nova).returning();
      return c.json(created, 201);
    } catch {
      console.warn("⚠️ DB indisponível — salvando fazenda em memória");
      memFazendas.push(nova);
      return c.json(nova, 201);
    }
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
    try {
      const [updated] = await db
        .update(fazendasTable)
        .set({ ...data, updated_at: new Date().toISOString() })
        .where(eq(fazendasTable.id, id))
        .returning();
      if (!updated) return c.json({ error: "Fazenda não encontrada" }, 404);
      return c.json(updated);
    } catch {
      console.warn("⚠️ DB indisponível — atualizando fazenda em memória");
      const idx = memFazendas.findIndex((f) => f.id === id);
      if (idx === -1) return c.json({ error: "Fazenda não encontrada" }, 404);
      memFazendas[idx] = { ...memFazendas[idx], ...data, updated_at: new Date().toISOString() };
      return c.json(memFazendas[idx]);
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar fazenda", message: err.message }, 500);
  }
});

// DELETE /api/fazendas/:id
fazendasRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    try {
      const [deleted] = await db.delete(fazendasTable).where(eq(fazendasTable.id, id)).returning();
      if (!deleted) return c.json({ error: "Fazenda não encontrada" }, 404);
      return c.json({ success: true });
    } catch {
      console.warn("⚠️ DB indisponível — removendo fazenda em memória");
      const before = memFazendas.length;
      memFazendas = memFazendas.filter((f) => f.id !== id);
      if (memFazendas.length === before) return c.json({ error: "Fazenda não encontrada" }, 404);
      return c.json({ success: true });
    }
  } catch (err: any) {
    return c.json({ error: "Erro ao remover fazenda", message: err.message }, 500);
  }
});

export default fazendasRouter;

import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { integracoesCredenciaisTable, lotesTable, vendasTable } from "../db/schema";
import { randomUUID } from "crypto";
import { encrypt, decrypt } from "../lib/encryption";
import {
  minasulLogin,
  minasulFetchVendas,
  minasulFetchVendaDetalhes,
} from "../services/minasul.service";

const integracoesRouter = new Hono();

type IntegracaoCredencial = {
  id: string;
  provider: string;
  username: string;
  password_encrypted: string;
  access_token: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const integracaoSchema = z.object({
  provider: z.enum(["minasul"]),
  username: z.string().trim().min(1, "Login é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});


/** Remove senha do retorno */
function sanitize(row: IntegracaoCredencial) {
  const { password_encrypted, access_token, ...safe } = row;
  return { ...safe, has_credentials: true };
}


integracoesRouter.get("/", async (c) => {
  try {
    const rows = await db.select().from(integracoesCredenciaisTable);
    return c.json(rows.map(sanitize));
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar integrações", message: err.message }, 500);
  }
});

// ── GET /api/integracoes/:id ─────────────────────────────────────────────────

integracoesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [row] = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, id))
      .limit(1);
    if (!row) return c.json({ error: "Integração não encontrada" }, 404);
    return c.json(sanitize(row));
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar integração", message: err.message }, 500);
  }
});

// ── POST /api/integracoes ────────────────────────────────────────────────────

integracoesRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = integracaoSchema.parse(body);
    const now = new Date().toISOString();

    const passwordEncrypted = encrypt(data.password);

    const novo = {
      id: randomUUID(),
      provider: data.provider,
      username: data.username,
      password_encrypted: passwordEncrypted,
      access_token: null,
      token_expires_at: null,
      last_sync_at: null,
      status: "ATIVO",
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    const [created] = await db
      .insert(integracoesCredenciaisTable)
      .values(novo)
      .returning();
    return c.json(sanitize(created), 201);
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao criar integração", message: err.message }, 500);
  }
});

// ── PUT /api/integracoes/:id ─────────────────────────────────────────────────

integracoesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const data = integracaoSchema.partial().parse(body);
    const now = new Date().toISOString();

    const updates: Record<string, any> = { updated_at: now };
    if (data.username) updates.username = data.username;
    if (data.password) updates.password_encrypted = encrypt(data.password);
    if (data.provider) updates.provider = data.provider;

    // Resetar status ao atualizar credenciais
    if (data.username || data.password) {
      updates.status = "ATIVO";
      updates.error_message = null;
      updates.access_token = null;
    }

    const [updated] = await db
      .update(integracoesCredenciaisTable)
      .set(updates)
      .where(eq(integracoesCredenciaisTable.id, id))
      .returning();
    if (!updated) return c.json({ error: "Integração não encontrada" }, 404);
    return c.json(sanitize(updated));
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return c.json({ error: "Erro de validação", details: err.errors }, 400);
    return c.json({ error: "Erro ao atualizar integração", message: err.message }, 500);
  }
});

// ── DELETE /api/integracoes/:id ──────────────────────────────────────────────

integracoesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const [deleted] = await db
      .delete(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, id))
      .returning();
    if (!deleted) return c.json({ error: "Integração não encontrada" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: "Erro ao remover integração", message: err.message }, 500);
  }
});



export default integracoesRouter;

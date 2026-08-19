import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { integracoesCredenciaisTable, lotesTable, vendasTable, amostrasTable } from "../db/schema";
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
  fazenda_id: string;
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

// ── GET /api/fazendas/:fazendaId/integracoes ─────────────────────────────────────────────────
integracoesRouter.get("/fazendas/:fazendaId/integracoes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const rows = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.fazenda_id, fazendaId));
    return c.json(rows.map(sanitize));
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar integrações", message: err.message }, 500);
  }
});

// ── GET /api/integracoes/:id ─────────────────────────────────────────────────
integracoesRouter.get("/integracoes/:id", async (c) => {
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

// ── POST /api/fazendas/:fazendaId/integracoes ────────────────────────────────────────────────────
integracoesRouter.post("/fazendas/:fazendaId/integracoes", async (c) => {
  const fazendaId = c.req.param("fazendaId");
  try {
    const body = await c.req.json();
    const data = integracaoSchema.parse(body);
    const now = new Date().toISOString();

    const passwordEncrypted = encrypt(data.password);

    const novo = {
      id: randomUUID(),
      fazenda_id: fazendaId,
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
integracoesRouter.put("/integracoes/:id", async (c) => {
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
integracoesRouter.delete("/integracoes/:id", async (c) => {
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

// ── POST /api/integracoes/:id/sync/detalhes ──────────────────────────────────
integracoesRouter.post("/integracoes/:id/sync/detalhes", async (c) => {
  const id = c.req.param("id");
  try {
    const { salesId, coopBatchId } = await c.req.json();
    if (!salesId || !coopBatchId) {
      return c.json({ error: "salesId e coopBatchId são obrigatórios" }, 400);
    }

    const [cred] = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, id))
      .limit(1);

    if (!cred) return c.json({ error: "Integração não encontrada" }, 404);

    if (!cred.access_token) {
      return c.json({ error: "Token não disponível. Faça login primeiro." }, 401);
    }

    const detalhe = await minasulFetchVendaDetalhes(cred.access_token, salesId, coopBatchId);

    let [amostraObj] = await db
      .select()
      .from(amostrasTable)
      .where(eq(amostrasTable.codigo_amostra, salesId))
      .limit(1);

    let amostrasCriadas = 0;
    let currentFazendaId = cred.fazenda_id; // Usa fazendaId da credencial

    if (!amostraObj && currentFazendaId) {
      const novaAmostra = {
        id: randomUUID(),
        fazenda_id: currentFazendaId,
        codigo_amostra: salesId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const [inserida] = await db.insert(amostrasTable).values(novaAmostra).returning();
      amostraObj = inserida;
      amostrasCriadas++;
    }

    let vendasCriadas = 0;
    let vendasAtualizadas = 0;

    if (amostraObj && currentFazendaId && detalhe) {
      const itens = detalhe.items || [];
      for (const item of itens) {
         const nfNumber = item.fiscalDocumentNumber || detalhe.fiscalDocumentNumber || null;
         
         const dadosVenda = {
           fazenda_id: currentFazendaId,
           amostra_id: amostraObj.id,
           numero_lote_cooperativa: coopBatchId,
           amostra: salesId,
           cliente: detalhe.purchName || "Minasul",
           sacas_vendidas: Number(item.qtyBags) || Number(detalhe.totalQty) || 0,
           tipo_venda: detalhe.salesType || "TERMO",
           data_venda: detalhe.salesDate || null,
           vl_bruto: Number(item.amount) || Number(detalhe.grossAmount) || 0,
           vl_liquido: Number(item.netAmount) || Number(detalhe.netAmount) || 0,
           valor_recebido: Number(item.netAmount) || Number(detalhe.netAmount) || 0,
           nf_venda: nfNumber,
           status: "RECEBIDO",
           updated_at: new Date().toISOString(),
         };

         const [vendaExistente] = await db
           .select()
           .from(vendasTable)
           .where(
             and(
               eq(vendasTable.numero_lote_cooperativa, coopBatchId),
               eq(vendasTable.amostra, salesId),
               nfNumber ? eq(vendasTable.nf_venda, nfNumber) : eq(vendasTable.id, vendasTable.id)
             )
           )
           .limit(1);

         if (vendaExistente) {
           await db.update(vendasTable).set(dadosVenda).where(eq(vendasTable.id, vendaExistente.id));
           vendasAtualizadas++;
         } else {
           await db.insert(vendasTable).values({
             ...dadosVenda,
             id: randomUUID(),
             created_at: new Date().toISOString()
           });
           vendasCriadas++;
         }
      }

      const vendasDaAmostra = await db.select().from(vendasTable).where(eq(vendasTable.amostra_id, amostraObj.id));
      let sumSacas = 0;
      let sumReceber = 0;
      for (const v of vendasDaAmostra) {
        sumSacas += Number(v.sacas_vendidas || 0);
        sumReceber += Number(v.vl_liquido ?? v.a_receber_previsto ?? 0);
      }
      
      await db.update(amostrasTable)
        .set({
           total_sacas: sumSacas,
           a_receber_previsto: sumReceber,
           updated_at: new Date().toISOString()
        })
        .where(eq(amostrasTable.id, amostraObj.id));
    }

    return c.json({
      success: true,
      message: "Sincronização de detalhes concluída",
      resultados: {
        amostras_novas: amostrasCriadas,
        vendas_novas: vendasCriadas,
        vendas_atualizadas: vendasAtualizadas
      }
    });
  } catch (err: any) {
    return c.json({ error: "Erro na sincronização de detalhes", message: err.message }, 500);
  }
});

export default integracoesRouter;

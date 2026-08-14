import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { integracoesCredenciaisTable, lotesTable, vendasTable } from "../db/schema";
import { randomUUID } from "crypto";
import { encrypt, decrypt } from "../lib/encryption";
import {
  minasulLogin,
  minasulFetchVendas,
  minasulFetchVendaDetalhes,
} from "../services/minasul.service";

// Montado em /api/integracoes pelo index.ts
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Remove senha do retorno */
function sanitize(row: IntegracaoCredencial) {
  const { password_encrypted, access_token, ...safe } = row;
  return { ...safe, has_credentials: true };
}

// ── GET /api/integracoes ─────────────────────────────────────────────────────

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

// ── POST /api/integracoes/:id/sync ───────────────────────────────────────────
// Dispara sincronização manual: login na Minasul → busca vendas

integracoesRouter.post("/:id/sync", async (c) => {
  const id = c.req.param("id");

  // Parâmetros opcionais do body
  const body = await c.req.json().catch(() => ({}));
  const now = new Date();
  const dateEnd = (body as any).dateEnd || now.toISOString().slice(0, 10);
  const dateIni =
    (body as any).dateIni ||
    new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);

  // 1. Buscar credenciais
  let credencial: IntegracaoCredencial | undefined;
  try {
    const [row] = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, id))
      .limit(1);
    credencial = row;
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar integração", message: err.message }, 500);
  }

  if (!credencial) {
    return c.json({ error: "Integração não encontrada" }, 404);
  }

  if (credencial.provider !== "minasul") {
    return c.json({ error: `Provider '${credencial.provider}' não suportado para sync` }, 400);
  }

  try {
    // 2. Descriptografar senha
    const password = decrypt(credencial.password_encrypted);

    // 3. Login na Minasul
    console.log(`🔑 Fazendo login na Minasul (user: ${credencial.username})...`);
    const loginResult = await minasulLogin(credencial.username, password);
    const token = loginResult.token;

    if (!token) {
      throw new Error("Token não retornado pela API da Minasul");
    }

    // 4. Buscar vendas
    console.log(`📦 Buscando vendas de ${dateIni} a ${dateEnd}...`);
    const vendas = await minasulFetchVendas(token, dateIni, dateEnd);

    // 5. Atualizar status da integração
    const updateData = {
      access_token: token,
      last_sync_at: new Date().toISOString(),
      status: "ATIVO",
      error_message: null,
      updated_at: new Date().toISOString(),
    };

    await db
      .update(integracoesCredenciaisTable)
      .set(updateData)
      .where(eq(integracoesCredenciaisTable.id, id));

    console.log(`✅ Sync concluído — ${Array.isArray(vendas) ? vendas.length : 0} vendas encontradas`);

    return c.json({
      success: true,
      provider: "minasul",
      periodo: { dateIni, dateEnd },
      total_vendas: Array.isArray(vendas) ? vendas.length : 0,
      vendas,
    });
  } catch (err: any) {
    console.error(`❌ Erro no sync Minasul:`, err.message);

    // Atualizar status de erro
    const errorData = {
      status: "ERRO",
      error_message: err.message,
      updated_at: new Date().toISOString(),
    };

    try {
      await db
        .update(integracoesCredenciaisTable)
        .set(errorData)
        .where(eq(integracoesCredenciaisTable.id, id));
    } catch {
      // Falha ao salvar erro no banco, ignorar silenciosamente
    }

    return c.json(
      { error: "Erro na sincronização", message: err.message, provider: "minasul" },
      500
    );
  }
});

// ── POST /api/integracoes/:id/sync/detalhes ──────────────────────────────────
// Busca detalhes de uma venda específica usando lote e amostra

integracoesRouter.post("/:id/sync/detalhes", async (c) => {
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const { coopBatchId, salesId } = body as { coopBatchId?: string; salesId?: string };

  if (!coopBatchId || !salesId) {
    return c.json({ error: "lote e amostra são obrigatórios" }, 400);
  }

  // Buscar credenciais
  let credencial: IntegracaoCredencial | undefined;
  try {
    const [row] = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, id))
      .limit(1);
    credencial = row;
  } catch (err: any) {
    return c.json({ error: "Erro ao buscar integração", message: err.message }, 500);
  }

  if (!credencial) {
    return c.json({ error: "Integração não encontrada" }, 404);
  }

  try {
    // Usar token em cache ou fazer novo login
    let token = credencial.access_token;

    if (!token) {
      const password = decrypt(credencial.password_encrypted);
      const loginResult = await minasulLogin(credencial.username, password);
      token = loginResult.token;

      // Salvar token
      try {
        await db
          .update(integracoesCredenciaisTable)
          .set({ access_token: token, updated_at: new Date().toISOString() })
          .where(eq(integracoesCredenciaisTable.id, id));
      } catch {
        /* fallback silencioso */
      }
    }

    const detalhesResponse = await minasulFetchVendaDetalhes(token!, salesId, coopBatchId);

    // Tratar a resposta da Minasul
    if (detalhesResponse && detalhesResponse.status === "Success" && detalhesResponse.SalesStatement?.response) {
      try {
        const parsedResponse = JSON.parse(detalhesResponse.SalesStatement.response);
        
        // 1. Procurar o Lote no nosso banco para pegar fazenda_id e lote_id
        const [dbLote] = await db
          .select()
          .from(lotesTable)
          .where(eq(lotesTable.numero_lote_cooperativa, coopBatchId))
          .limit(1);

        let vendaCriada = null;
        
        if (dbLote) {
          // Helper para remover vírgulas e converter para float
          const parseNumber = (val: string | undefined | null) => {
            if (!val) return null;
            const parsed = parseFloat(val.replace(/,/g, ""));
            return isNaN(parsed) ? null : parsed;
          };

          // Formatar data MM/DD/YYYY para YYYY-MM-DD
          let dataVendaFormatada = null;
          if (parsedResponse.SalesDate) {
            const parts = parsedResponse.SalesDate.split("/");
            if (parts.length === 3) {
              const m = parts[0].padStart(2, '0');
              const d = parts[1].padStart(2, '0');
              const y = parts[2];
              dataVendaFormatada = `${y}-${m}-${d}`;
            }
          }

          const novaVenda = {
            id: randomUUID(),
            fazenda_id: dbLote.fazenda_id,
            lote_id: dbLote.id,
            numero_lote_cooperativa: coopBatchId,
            amostra: salesId,
            cliente: parsedResponse.Name || null,
            sacas_vendidas: parseNumber(parsedResponse.QtyBags) || 0,
            tipo_venda: "TERMO", // Valor seguro, ou inferir de SalesType se for estrito
            data_venda: dataVendaFormatada,
            vl_bruto: parseNumber(parsedResponse.NetTotalAmount),
            vl_liquido: parseNumber(parsedResponse.NetAmountToPay),
            valor_recebido: parseNumber(parsedResponse.NetAmountToPay),
            descontos: parseNumber(parsedResponse.Discount),
            premio_liquido_funrural: parseNumber(parsedResponse.FunruralAmount),
            cooperado: parsedResponse.CoopPropertyName || null,
            status: "RECEBIDO", 
            observacoes: `Importado via Minasul. Tipo original: ${parsedResponse.SalesType}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const [inserida] = await db.insert(vendasTable).values(novaVenda).returning();
          
          vendaCriada = inserida;
        }

        return c.json({
          message: vendaCriada ? "1 venda encontrada e vinculada com sucesso" : "1 venda encontrada na Minasul, mas o Lote não está cadastrado no sistema (não foi possível vincular).",
          data: {
            data_envio_cooperativa: parsedResponse.SalesDate || null,
            nf_remessa_cooperativa: parsedResponse.PurchAgreementId || null,
            venda_criada: vendaCriada,
            _raw: parsedResponse
          }
        });
      } catch (parseError) {
        console.error("Erro ao fazer parse do response da minasul", parseError);
        return c.json({ message: "Vendas não encontradas (erro ao ler dados)" }, 404);
      }
    } else {
      return c.json({ message: "Vendas não encontradas" }, 404);
    }

  } catch (err: any) {
    return c.json(
      { error: "Erro ao buscar detalhes", message: err.message },
      500
    );
  }
});

export default integracoesRouter;

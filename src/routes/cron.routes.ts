import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  integracoesCredenciaisTable,
  lotesTable,
  amostrasTable,
  vendasTable,
} from "../db/schema";
import { decrypt } from "../lib/encryption";
import { randomUUID } from "crypto";
import {
  minasulLogin,
  minasulFetchVendas,
  minasulFetchVendaDetalhes,
} from "../services/minasul.service";

const cronRouter = new Hono();

// Helper numérico para formatar os valores monetários
const parseNumber = (val: string | undefined | null) => {
  if (!val) return null;
  const parsed = parseFloat(val.replace(/,/g, ""));
  return isNaN(parsed) ? null : parsed;
};

// Middleware simples de autenticação (usa cabeçalho CRON_SECRET)
cronRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const secret = process.env.CRON_SECRET || "desenvolvimento_local_secret";

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.error("Tentativa de acesso não autorizada na rota de CRON");
    return c.json({ error: "Acesso não autorizado" }, 401);
  }
  await next();
});

// POST /api/crons/sync-minasul-vendas
cronRouter.post("/sync-minasul-vendas", async (c) => {
  const integrationId = "1"; // O usuário solicitou padrão fixo 1
  try {
    const [credencial] = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.id, integrationId))
      .limit(1);

    if (!credencial || credencial.provider !== "minasul") {
      return c.json({ error: "Credencial 1 da Minasul não encontrada." }, 404);
    }

    const password = decrypt(credencial.password_encrypted);
    console.log(`[CRON] Fazendo login na Minasul (user: ${credencial.username})...`);
    
    const loginResult = await minasulLogin(credencial.username, password);
    const token = loginResult.token;

    // Salvar token em cache
    await db
      .update(integracoesCredenciaisTable)
      .set({ access_token: token, updated_at: new Date().toISOString() })
      .where(eq(integracoesCredenciaisTable.id, integrationId));

    // Data de hoje (UTC/Local simplificado para ISO yyyy-mm-dd)
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[CRON] Buscando vendas da Minasul para o dia: ${today}`);
    console.log('today: ', today);
    const vendasResumo = await minasulFetchVendas(token, '2026-06-24', '2026-06-24');
    if (!vendasResumo || !Array.isArray(vendasResumo)) {
      return c.json({ message: "Nenhuma venda retornada hoje" });
    }

    let amostrasCriadas = 0;
    let vendasCriadas = 0;

    for (const resumo of vendasResumo) {
      const salesId = resumo.salesId; // Amostra ex: AM-00123
      const coopBatchId = resumo.coopBatchId; // Lote Cooperativa

      if (!salesId || !coopBatchId) continue;

      // Localizar o Lote no nosso BD pelo número da cooperativa
      const [dbLote] = await db
        .select()
        .from(lotesTable)
        .where(eq(lotesTable.numero_lote_cooperativa, coopBatchId))
        .limit(1);

      if (!dbLote) {
        console.warn(`[CRON] Lote ${coopBatchId} não cadastrado no banco local. Ignorando.`);
        continue;
      }

      // Atualizar o campo amostra do Lote conforme solicitado pelo usuário
      if (dbLote.amostra !== salesId) {
        await db
          .update(lotesTable)
          .set({ amostra: salesId, updated_at: new Date().toISOString() })
          .where(eq(lotesTable.id, dbLote.id));
      }

      // 1. Encontrar ou Criar a Amostra
      let [amostraObj] = await db
        .select()
        .from(amostrasTable)
        .where(eq(amostrasTable.codigo_amostra, salesId))
        .limit(1);

      if (!amostraObj) {
        const novaAmostra = {
          id: randomUUID(),
          fazenda_id: dbLote.fazenda_id,
          codigo_amostra: salesId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const [inserida] = await db.insert(amostrasTable).values(novaAmostra).returning();
        amostraObj = inserida;
        amostrasCriadas++;
      }

      // 2. Buscar detalhes para a venda específica
      console.log(`[CRON] Buscando detalhes de venda para lote ${coopBatchId} / amostra ${salesId}`);
      const detalhesResponse = await minasulFetchVendaDetalhes(token, salesId, coopBatchId);

      if (detalhesResponse && detalhesResponse.status === "Success" && detalhesResponse.SalesStatement?.response) {
        let rawResponseString = detalhesResponse.SalesStatement.response;
        
        if (typeof rawResponseString === "string" && rawResponseString.startsWith('"') && rawResponseString.endsWith('"')) {
          rawResponseString = rawResponseString.slice(1, -1).replace(/\\"/g, '"');
        }

        let parsedResponse = JSON.parse(rawResponseString);
        if (typeof parsedResponse === "string") {
          parsedResponse = JSON.parse(parsedResponse);
        }

        let tipoVendaFormatado = parsedResponse.SalesType || "TERMO";
        if (tipoVendaFormatado.toUpperCase().includes("TERMO")) {
          tipoVendaFormatado = "TERMO";
        } else if (tipoVendaFormatado.toUpperCase().includes("FISICA") || tipoVendaFormatado.toUpperCase().includes("FÍSICA")) {
          tipoVendaFormatado = "FISICA";
        }

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

        const dadosVenda = {
          fazenda_id: dbLote.fazenda_id,
          lote_id: dbLote.id,
          amostra_id: amostraObj.id, // Nova estrutura de relacionamento FK
          numero_lote_cooperativa: coopBatchId,
          amostra: salesId, // Fallback/String importada
          cliente: parsedResponse.Name || null,
          sacas_vendidas: parseNumber(parsedResponse.QtyBags) || 0,
          tipo_venda: tipoVendaFormatado, 
          data_venda: dataVendaFormatada,
          vl_bruto: parseNumber(parsedResponse.NetTotalAmount) || parseNumber(parsedResponse.SalesAmount) || parseNumber(parsedResponse.TotalPrice),
          vl_liquido: parseNumber(parsedResponse.NetAmountToPay) || parseNumber(parsedResponse.NetTotalAmount),
          valor_recebido: parseNumber(parsedResponse.NetAmountToPay) || parseNumber(parsedResponse.NetTotalAmount),
          descontos: parseNumber(parsedResponse.Discount) || 0,
          premio_liquido_funrural: parseNumber(parsedResponse.FunruralAmount) || 0,
          nr_remessa_cooperativa: parsedResponse.PurchAgreementId || parsedResponse.InventBatchId || null,
          cooperado: parsedResponse.CoopPropertyName || null,
          status: "RECEBIDO", 
          observacoes: `[Criado pela API (CRON)] Importado via Minasul. Tipo original: ${parsedResponse.SalesType || 'N/A'}`,
          updated_at: new Date().toISOString(),
        };

        const [vendaExistente] = await db
          .select()
          .from(vendasTable)
          .where(
            and(
              eq(vendasTable.numero_lote_cooperativa, coopBatchId),
              eq(vendasTable.amostra, salesId)
            )
          )
          .limit(1);

        if (vendaExistente) {
          await db
            .update(vendasTable)
            .set(dadosVenda)
            .where(eq(vendasTable.id, vendaExistente.id));
        } else {
          const novaVenda = {
            ...dadosVenda,
            id: randomUUID(),
            created_at: new Date().toISOString(),
          };
          await db.insert(vendasTable).values(novaVenda);
          vendasCriadas++;
        }
      }
    }

    return c.json({
      success: true,
      message: "Sync do cron executado com sucesso",
      resultados: {
        amostras_novas: amostrasCriadas,
        vendas_novas: vendasCriadas,
      }
    });
  } catch (err: any) {
    console.error("[CRON ERROR]:", err.message);
    return c.json({ error: "Erro na rotina de sincronização do cron", message: err.message }, 500);
  }
});

export default cronRouter;

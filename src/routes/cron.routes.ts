import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  integracoesCredenciaisTable,
  lotesTable,
  amostrasTable,
  vendasTable,
  fazendasTable,
} from "../db/schema";
import { decrypt } from "../lib/encryption";
import { randomUUID } from "crypto";
import {
  minasulFetchVendas,
  minasulLogin
} from "../services/minasul.service";
import { env } from "../config/env";

const cronRouter = new Hono();

// Helper numérico para formatar os valores monetários (BRL string ou number nativo)
const parseNumber = (val: any) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // Ex: "57.681,9400" -> "57681.9400"
    const cleanStr = val.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Middleware simples de autenticação (usa cabeçalho CRON_SECRET)
cronRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const secret = env.CRON_SECRET;

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

    const vendasResumo = await minasulFetchVendas(token, today, today);

    if (!vendasResumo || !Array.isArray(vendasResumo)) {
      return c.json({ message: "Nenhuma venda retornada hoje" });
    }

    let amostrasCriadas = 0;
    let vendasCriadas = 0;

    for (const resumo of vendasResumo) {
      const salesId = resumo.COOPBATCHFORSALESID; // Amostra ex: AM-00123
      const coopBatchId = resumo.COOPBATCHID; // Lote Cooperativa

      if (!salesId || !coopBatchId) continue;

      // Localizar o Lote no nosso BD pelo número da cooperativa
      const [dbLote] = await db
        .select()
        .from(lotesTable)
        .where(eq(lotesTable.numero_lote_cooperativa, coopBatchId))
        .limit(1);

      let currentFazendaId = dbLote?.fazenda_id;
      if (!currentFazendaId) {
        const [fallbackFazenda] = await db.select().from(fazendasTable).limit(1);
        if (fallbackFazenda) {
          currentFazendaId = fallbackFazenda.id;
        } else {
          console.warn(`[CRON] Nenhuma fazenda cadastrada. Impossível vincular registros.`);
          continue;
        }
      }

      // Se achou lote, atualiza a amostra nele
      if (dbLote && dbLote.amostra !== salesId) {
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
          fazenda_id: currentFazendaId,
          codigo_amostra: salesId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const [inserida] = await db.insert(amostrasTable).values(novaAmostra).returning();
        amostraObj = inserida;
        amostrasCriadas++;
      }

      // 2. Montar dados da Venda usando diretamente o "resumo"
      let tipoVendaFormatado = resumo.SALESTYPE || "TERMO";
      if (tipoVendaFormatado.toUpperCase().includes("TERMO")) {
        tipoVendaFormatado = "TERMO";
      } else if (tipoVendaFormatado.toUpperCase().includes("FISICA") || tipoVendaFormatado.toUpperCase().includes("FÍSICA") || tipoVendaFormatado.toUpperCase().includes("MELHOR PREÇO")) {
        tipoVendaFormatado = "FISICA";
      }

      let dataVendaFormatada = null;
      if (resumo.DOCUMENTDATE) {
        const parts = resumo.DOCUMENTDATE.split("/");
        if (parts.length === 3) {
          const m = parts[1].padStart(2, '0');
          const d = parts[0].padStart(2, '0');
          const y = parts[2];
          dataVendaFormatada = `${y}-${m}-${d}`;
        }
      }

      let dataRecebimentoFormatada = null;
      if (resumo.PAYMDATE) {
        const parts = resumo.PAYMDATE.split("/");
        if (parts.length === 3) {
          const m = parts[1].padStart(2, '0');
          const d = parts[0].padStart(2, '0');
          const y = parts[2];
          dataRecebimentoFormatada = `${y}-${m}-${d}`;
        }
      }

      const dadosVenda = {
        fazenda_id: currentFazendaId,
        lote_id: dbLote?.id || null,
        amostra_id: amostraObj.id, 
        numero_lote_cooperativa: coopBatchId,
        amostra: salesId, 
        cliente: "Minasul", // Padronizado já que veio da API
        sacas_vendidas: parseNumber(resumo.QTYBAGS) || 0,
        tipo_venda: tipoVendaFormatado, 
        data_venda: dataVendaFormatada,
        vl_bruto: parseNumber(resumo.LINEAMOUNT) || parseNumber(resumo.SALESPRICE),
        vl_liquido: parseNumber(resumo.NETLINEAMOUNT) || parseNumber(resumo.LINEAMOUNT),
        valor_recebido: parseNumber(resumo.NETLINEAMOUNT) || parseNumber(resumo.LINEAMOUNT),
        data_recebimento: dataRecebimentoFormatada,
        premio_rainforest: parseNumber(resumo.AWARDVALUE) || 0,
        nr_remessa_cooperativa: resumo.FISCALDOCUMENTNUMBER || null,
        cooperado: resumo.PROPERTYDESCR || null,
        status: "RECEBIDO", 
        observacoes: `[Criado pela API (CRON)] Importado via Minasul. Tipo original: ${resumo.SALESTYPE || 'N/A'}. Lote Coop: ${coopBatchId}`,
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

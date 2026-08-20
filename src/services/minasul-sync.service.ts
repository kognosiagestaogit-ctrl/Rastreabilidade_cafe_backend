import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { lotesTable, amostrasTable, vendasTable } from "../db/schema";
import { minasulFetchVendas } from "./minasul.service";
import { randomUUID } from "crypto";

const parseNumber = (val: any) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleanStr = val.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

export async function syncMinasulVendasPeriodo(
  credencialFazendaId: string,
  token: string,
  dateIni: string,
  dateEnd: string
) {
  let amostrasCriadas = 0;
  let vendasCriadas = 0;

  const vendasResumo = await minasulFetchVendas(token, dateIni, dateEnd);

  if (!vendasResumo || !Array.isArray(vendasResumo)) {
    return { amostras_novas: amostrasCriadas, vendas_novas: vendasCriadas };
  }

  for (const resumo of vendasResumo) {
    const salesId = resumo.COOPBATCHFORSALESID;
    const coopBatchId = resumo.COOPBATCHID;

    if (!salesId || !coopBatchId) continue;

    const [dbLote] = await db
      .select()
      .from(lotesTable)
      .where(eq(lotesTable.numero_lote_cooperativa, coopBatchId))
      .limit(1);

    let currentFazendaId = dbLote?.fazenda_id || credencialFazendaId;

    if (dbLote && dbLote.amostra !== salesId) {
      await db
        .update(lotesTable)
        .set({ amostra: salesId, updated_at: new Date().toISOString() })
        .where(eq(lotesTable.id, dbLote.id));
    }

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
      cliente: "Minasul", 
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
      observacoes: `[Criado pela API] Importado via Minasul. Tipo original: ${resumo.SALESTYPE || 'N/A'}. Lote Coop: ${coopBatchId}`,
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

  return { amostras_novas: amostrasCriadas, vendas_novas: vendasCriadas };
}

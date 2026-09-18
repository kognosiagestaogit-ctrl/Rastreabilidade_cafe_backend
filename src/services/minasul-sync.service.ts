import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import { lotesTable, amostrasTable, vendasTable } from "../db/schema";
import { minasulFetchVendas } from "./minasul.service";
import { recalcularTotaisAmostra } from "./amostras.service";
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

/**
 * Cria ou atualiza os registros de vendas e amostras no banco de dados
 * com base no payload já baixado da Minasul.
 */
export async function syncMinasulVendasFromPayload(
  credencialFazendaId: string,
  vendasResumo: any[]
) {
  let amostrasCriadas = 0;
  let vendasCriadas = 0;
  const amostrasAfetadas = new Set<string>();

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
      .where(sql`REPLACE(${lotesTable.numero_lote_cooperativa}, '/', '') = ${coopBatchId.replace(/\//g, '')}`)
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

    let padraoFormatado = null;
    let quebraFormatada = null;
    let peneiraFormatada = null;

    if (resumo.DETAIL) {
      const detailParts = resumo.DETAIL.split("-");
      padraoFormatado = detailParts[0] || null;
      
      if (detailParts[1] && detailParts[1].trim() !== "") {
        const parsedQuebra = parseNumber(detailParts[1]);
        if (parsedQuebra !== null) {
          quebraFormatada = parsedQuebra;
        }
      }

      peneiraFormatada = detailParts[3] || null;
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
      padrao: padraoFormatado,
      quebra: quebraFormatada,
      peneira: peneiraFormatada,
      premio_rainforest: parseNumber(resumo.AWARDVALUE) || 0,
      nr_remessa_cooperativa: resumo.FISCALDOCUMENTNUMBER || dbLote?.nf_remessa_cooperativa || null,
      data_envio_armazem: dbLote?.data_envio_cooperativa || null,
      sacas_do_lote: dbLote?.numero_sacas || null,
      sobra_sacas: dbLote?.numero_sacas != null ? dbLote.numero_sacas - (parseNumber(resumo.QTYBAGS) || 0) : null,
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

    if (amostraObj?.id) {
      amostrasAfetadas.add(amostraObj.id);
    }
  }

  // Recalcular totais de sacas e valores para as amostras afetadas
  if (amostrasAfetadas.size > 0) {
    for (const amostraId of amostrasAfetadas) {
      await recalcularTotaisAmostra(amostraId);
    }
  }

  return { amostras_novas: amostrasCriadas, vendas_novas: vendasCriadas };
}

/**
 * Função mantida para compatibilidade, faz o fetch e o sync
 */
export async function syncMinasulVendasPeriodo(
  credencialFazendaId: string,
  token: string,
  dateIni: string,
  dateEnd: string
) {
  const vendasResumo = await minasulFetchVendas(token, dateIni, dateEnd);
  return syncMinasulVendasFromPayload(credencialFazendaId, vendasResumo);
}

import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { amostrasTable, vendasTable } from "../db/schema";

export async function recalcularTotaisAmostra(amostraId: string) {
  if (!amostraId) return;
  const todasVendas = await db.select().from(vendasTable).where(eq(vendasTable.amostra_id, amostraId));
  let sumSacas = 0;
  let sumReceber = 0;
  for (const v of todasVendas) {
    sumSacas += Number(v.sacas_vendidas || 0);
    sumReceber += Number(v.vl_liquido ?? v.a_receber_previsto ?? 0);
  }
  await db
    .update(amostrasTable)
    .set({ 
      total_sacas: sumSacas, 
      a_receber_previsto: sumReceber,
      updated_at: new Date().toISOString()
    })
    .where(eq(amostrasTable.id, amostraId));
}

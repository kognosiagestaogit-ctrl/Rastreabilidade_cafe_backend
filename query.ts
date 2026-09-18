import { db } from "./src/db/client";
import { vendasTable, lotesTable } from "./src/db/schema";

async function run() {
  const vendas = await db.select().from(vendasTable);
  const lotes = await db.select().from(lotesTable);
  console.log("=== VENDAS ===");
  console.log(vendas.map(v => ({ id: v.id, numero_lote_cooperativa: v.numero_lote_cooperativa, lote_id: v.lote_id, sobra_sacas: v.sobra_sacas })));
  console.log("=== LOTES ===");
  console.log(lotes.map(l => ({ id: l.id, numero_lote_cooperativa: l.numero_lote_cooperativa })));
  process.exit(0);
}
run();

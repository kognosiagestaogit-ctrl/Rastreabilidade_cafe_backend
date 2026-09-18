import { db } from "./src/db/client.ts";
import { vendasTable } from "./src/db/schema.ts";
const vendas = await db.select().from(vendasTable);
console.log(vendas.map(v => ({ id: v.id, amostra: v.amostra, coop: v.numero_lote_cooperativa })));
process.exit(0);

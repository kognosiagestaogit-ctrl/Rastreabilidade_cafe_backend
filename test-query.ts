import { db } from "./src/db/client.ts";
import { lotesTable } from "./src/db/schema.ts";
import { sql } from "drizzle-orm";
const id = "26270100028";
const lotes = await db.select().from(lotesTable).where(sql`REPLACE(${lotesTable.numero_lote_cooperativa}, '/', '') = ${id}`);
console.log(lotes.map(l => l.numero_lote_cooperativa));
process.exit(0);

import { db } from "./src/db/client";
import { lotesTable } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() {
  const clean = "26270100028";
  const [lote] = await db.select().from(lotesTable).where(sql`REGEXP_REPLACE(${lotesTable.numero_lote_cooperativa}, '[^a-zA-Z0-9]', '', 'g') = ${clean}`).limit(1);
  console.log("MATCH:", lote?.numero_lote_cooperativa);
  process.exit(0);
}
run();

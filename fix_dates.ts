import { db } from "./src/db/client";
import { fazendasTable, lotesTable } from "./src/db/schema";

async function run() {
    const f = await db.select().from(fazendasTable);
    console.log("FAZENDAS:", f);
    const lotes = await db.select().from(lotesTable);
    console.log("Total lotes:", lotes.length);
    process.exit(0);
}
run();

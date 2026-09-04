import { db } from "./src/db/client";
import { fazendasTable } from "./src/db/schema";
async function run() {
  const f = await db.select().from(fazendasTable);
  console.log("FAZENDAS NO PROD:", f);
  process.exit(0);
}
run();

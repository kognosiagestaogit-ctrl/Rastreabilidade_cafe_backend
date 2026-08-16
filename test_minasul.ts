import { minasulLogin, minasulFetchVendaDetalhes } from "./src/services/minasul.service";
import { decrypt } from "./src/lib/encryption";
import { db } from "./src/db/client";
import { integracoesCredenciaisTable } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const [row] = await db.select().from(integracoesCredenciaisTable).where(eq(integracoesCredenciaisTable.id, "1")).limit(1);
  const password = decrypt(row.password_encrypted);
  const { token } = await minasulLogin(row.username, password);
  
  const detalhes = await minasulFetchVendaDetalhes(token, "AM-00323992", "26270100112");
  console.log(JSON.stringify(detalhes, null, 2));
  
  if (detalhes.status === "Success" && detalhes.SalesStatement?.response) {
    console.log("----- PARSED RESPONSE -----");
    const parsed = JSON.parse(detalhes.SalesStatement.response);
    console.log(JSON.stringify(parsed, null, 2));
  }
}

run().catch(console.error);

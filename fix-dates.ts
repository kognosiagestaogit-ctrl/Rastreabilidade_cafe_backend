import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

const tables = {
  amostras: ["data_recebimento"],
  lotes: ["data_colheita_inicio", "data_colheita_fim", "data_entrada_terreiro_inicio", "data_entrada_terreiro_fim", "data_saida_terreiro", "data_entrada_secador", "data_saida_secador", "data_beneficio", "data_envio_cooperativa"],
  vendas: ["data_venda", "data_recebimento", "data_envio_armazem", "data_recebimento_premio"]
};

for (const [table, cols] of Object.entries(tables)) {
  for (const col of cols) {
    try {
      await db.execute(sql.raw(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = '';`));
      await db.execute(sql.raw(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE date USING ${col}::date;`));
      console.log(`Successfully migrated ${table}.${col}`);
    } catch (err: any) {
      console.log(`Failed for ${table}.${col}: ${err.message}`);
    }
  }
}
process.exit(0);

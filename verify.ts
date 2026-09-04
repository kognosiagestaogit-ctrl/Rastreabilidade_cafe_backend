import { db } from "./src/db/client";
import { lotesTable } from "./src/db/schema";
async function run() {
    const lotes = await db.select().from(lotesTable);
    console.log("Total lotes:", lotes.length);
    if (lotes.length > 0) {
        console.log("Exemplo de datas do lote:", {
            data_colheita_inicio: lotes[0].data_colheita_inicio,
            data_entrada_terreiro: lotes[0].data_entrada_terreiro,
        });
    }
    process.exit(0);
}
run();

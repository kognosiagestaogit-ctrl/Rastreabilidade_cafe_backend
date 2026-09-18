import fs from 'fs';
import { db } from './src/db/client';
import { fazendasTable, talhoesTable } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const raw = fs.readFileSync('/Users/breno/workspace/personal/pedraNegra_importacoes/RASTREABILIDADE E VENDAS 2026_unmerged.json', 'utf8').replace(/\bNaN\b/g, 'null');
  const data = JSON.parse(raw);
  
  const fazendaId = "4721d699-be8b-4a29-9cff-b6a3b2e6b49a";
  const [f] = await db.select().from(fazendasTable).where(eq(fazendasTable.id, fazendaId));
  if (!f) {
    await db.insert(fazendasTable).values({
      id: fazendaId,
      nome: "Fazenda Pedra Negra",
      proprietario: "João Neto",
      cooperado_iniciais: "ZN",
      localizacao: "Varginha/Minas Gerais",
      cor: "emerald"
    });
  }

  const talhoesSet = new Set<string>();
  for (const item of data) {
    if (item.talhao_ids) {
      for (const t of item.talhao_ids) talhoesSet.add(t);
    }
  }

  for (const tid of talhoesSet) {
    const [t] = await db.select().from(talhoesTable).where(eq(talhoesTable.id, tid));
    if (!t) {
      await db.insert(talhoesTable).values({
        id: tid,
        fazenda_id: fazendaId,
        nome: "Talhão " + tid.substring(0,4),
        variedade: "Mundo Novo",
        hectares: "1.0",
        ano_plantio: 2000
      });
    }
  }

  console.log("Seeded Fazenda and Talhões.");
}
run();

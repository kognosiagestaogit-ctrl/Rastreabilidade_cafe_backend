import * as xlsx from 'xlsx';
import { db } from "./client";
import { fazendasTable, talhoesTable, lotesTable } from "./schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as path from 'path';
import * as fs from 'fs';

function parseExcelDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    const dateObj = xlsx.SSF.parse_date_code(val);
    if (dateObj) {
        const yyyy = dateObj.y;
        const mm = String(dateObj.m).padStart(2, '0');
        const dd = String(dateObj.d).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
  }
  
  let str = String(val).trim();
  
  // Format: "17,18/05/26" -> get the first day
  if (str.includes(',') && str.includes('/')) {
      const slashParts = str.split('/');
      if (slashParts.length >= 2) {
          let daysPart = slashParts[0];
          const day = daysPart.split(',')[0].trim();
          const month = slashParts[1].trim();
          let year = slashParts[2] ? slashParts[2].trim() : String(new Date().getFullYear());
          if (year.length === 2) year = '20' + year;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
  } else if (str.includes('/')) {
      // Format: DD/MM/YYYY or DD/MM/YY
      const parts = str.split('/');
      if (parts.length === 3) {
          const day = parts[0].trim();
          const month = parts[1].trim();
          let year = parts[2].trim();
          if (year.length === 2) year = '20' + year;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
  }
  
  return str;
}

async function main() {
    const defaultPath = './spreadsheet.xlsx';
    let filePath = process.argv[2] || defaultPath;
    
    if (!fs.existsSync(filePath)) {
        console.error(`Erro: Arquivo Excel não encontrado em '${filePath}'`);
        console.log("Uso: bun run src/db/upload_lotes_script.ts /caminho/para/sua/planilha.xlsx");
        process.exit(1);
    }

    console.log(`Lendo arquivo: ${filePath}`);
    
    console.log("Fetching fazenda...");
    const fazendas = await db.select().from(fazendasTable);
    if (fazendas.length === 0) {
        console.error("Nenhuma fazenda encontrada no banco!");
        process.exit(1);
    }
    const fazendaId = fazendas[0].id;
    console.log(`Usando Fazenda ID: ${fazendaId}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['RASTREABILIDADE 2026'];
    const json = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    
    const data = json.slice(2).filter(row => row.length > 0 && row[0] !== undefined && String(row[0]) !== 'NR. LOTE FAZENDA (LOTÃO)');
    
    console.log(`Found ${data.length} lotes. Extracting talhões...`);
    
    const talhoesSet = new Set<string>();
    data.forEach(row => {
        if (row[1]) {
            const t = String(row[1]).split(',').map(s => s.trim());
            t.forEach(x => talhoesSet.add(x));
        }
    });
    
    const talhoesNomes = Array.from(talhoesSet);
    console.log("Unique Talhões:", talhoesNomes);
    
    let existingTalhoes = await db.select().from(talhoesTable).where(eq(talhoesTable.fazenda_id, fazendaId));
    const talhaoMap = new Map(existingTalhoes.map(t => [t.nome.toUpperCase(), t.id]));
    
    for (const nome of talhoesNomes) {
        const upperNome = nome.toUpperCase();
        if (!talhaoMap.has(upperNome)) {
            console.log(`Creating talhão: ${nome}`);
            const newId = randomUUID();
            await db.insert(talhoesTable).values({
                id: newId,
                fazenda_id: fazendaId,
                nome: nome,
            });
            talhaoMap.set(upperNome, newId);
        }
    }
    
    console.log("Talhões sync complete.");
    console.log("Inserting lotes...");
    for (const row of data) {
        const numLoteFazenda = String(row[0]);
        let talhaoIds: string[] = [];
        if (row[1]) {
            talhaoIds = String(row[1]).split(',').map(s => talhaoMap.get(s.trim().toUpperCase())!).filter(Boolean);
        }
        
        const loteId = randomUUID();
        
        await db.insert(lotesTable).values({
            id: loteId,
            fazenda_id: fazendaId,
            talhao_ids: talhaoIds,
            safra: 2026,
            numero_lote_fazenda: numLoteFazenda,
            lote_colheita: row[2] !== undefined ? String(row[2]) : null,
            data_colheita_inicio: parseExcelDate(row[3]),
            colheita_tipo: row[4] !== undefined ? String(row[4]) : null,
            tipo_cafe: row[5] !== undefined ? String(row[5]) : null,
            data_entrada_terreiro: parseExcelDate(row[6]),
            data_saida_terreiro: parseExcelDate(row[7]),
            data_entrada_secador: parseExcelDate(row[8]),
            data_saida_secador: parseExcelDate(row[9]),
            umidade: row[10] !== undefined ? Number(row[10]) : null,
            numero_tulha: row[11] !== undefined ? String(row[11]) : null,
            data_beneficio: parseExcelDate(row[12]),
            data_envio_cooperativa: parseExcelDate(row[13]),
            numero_sacas: row[14] !== undefined ? Number(row[14]) : null,
            numero_lote_cooperativa: row[15] !== undefined ? String(row[15]) : null,
            nf_remessa_cooperativa: row[16] !== undefined ? String(row[16]) : null,
            observacoes: row[17] !== undefined ? String(row[17]) : null,
            status: "ENVIADO_COOPERATIVA",
        });
    }
    
    console.log("Lotes successfully inserted with corrected dates.");
    process.exit(0);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});

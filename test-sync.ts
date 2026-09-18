import { db } from "./src/db/client.ts";
import { syncMinasulVendasFromPayload } from "./src/services/minasul-sync.service.ts";
import { vendasTable, lotesTable } from "./src/db/schema.ts";

const payload = [
  {
      "BATCHTYPE": "PE",
      "RECID": "5637995089",
      "COOPBATCHID": "26270100028",
      "PROPERTYDESCR": "FAZENDA PEDRA NEGRA",
      "COOPBATCHFORSALESID": "AM-00311777",
      "DOCUMENTDATE": "17/06/2026",
      "PAYMDATE": "24/06/2026",
      "SALESPRICE": "1.445,6268",
      "QTYKG": "2.418,0000",
      "QTYBAGS": "40,3000",
      "LINEAMOUNT": "57.681,9400",
      "LINEAMOUNTICMS": "58.258,7600",
      "NETLINEAMOUNT": "56.605,3900",
      "SALESTYPE": "MELHOR PREÇO",
      "AWARDVALUE": 20,
      "TERMNUM": "",
      "DETAIL": "31A-26-2627-",
      "FISCALDOCUMENTRECID": "5641219643",
      "FISCALDOCUMENTNUMBER": "000960789"
  }
];

const res = await syncMinasulVendasFromPayload("teste-fazenda", payload);
console.log("SYNC RESULT:", res);

const vendas = await db.select().from(vendasTable);
console.log("UPDATED VENDA:");
console.log(vendas.filter(v => v.amostra === "AM-00311777" && v.numero_lote_cooperativa === "26270100028").map(v => ({ id: v.id, lote: v.lote_id })));

process.exit(0);

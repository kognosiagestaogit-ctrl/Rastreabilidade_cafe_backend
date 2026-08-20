import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  integracoesCredenciaisTable,
  lotesTable,
  amostrasTable,
  vendasTable,
  fazendasTable,
} from "../db/schema";
import { decrypt } from "../lib/encryption";
import { randomUUID } from "crypto";
import {
  minasulFetchVendas,
  minasulLogin
} from "../services/minasul.service";
import { syncMinasulVendasPeriodo } from "../services/minasul-sync.service";
import { env } from "../config/env";

const cronRouter = new Hono();

// Helper numérico para formatar os valores monetários (BRL string ou number nativo)
const parseNumber = (val: any) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // Ex: "57.681,9400" -> "57681.9400"
    const cleanStr = val.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Middleware simples de autenticação (usa cabeçalho CRON_SECRET)
cronRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const secret = env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.error("Tentativa de acesso não autorizada na rota de CRON");
    return c.json({ error: "Acesso não autorizado" }, 401);
  }
  await next();
});

// POST /api/crons/sync-minasul-vendas
cronRouter.post("/sync-minasul-vendas", async (c) => {
  const integrationId = "1"; // O usuário solicitou padrão fixo 1
  try {
    const credenciais = await db
      .select()
      .from(integracoesCredenciaisTable)
      .where(eq(integracoesCredenciaisTable.provider, "minasul"));

    if (!credenciais || credenciais.length === 0) {
      return c.json({ error: "Nenhuma credencial Minasul configurada." }, 404);
    }

    let amostrasCriadas = 0;
    let vendasCriadas = 0;

    for (const credencial of credenciais) {
      try {
        const password = decrypt(credencial.password_encrypted);
        console.log(`[CRON] Fazendo login na Minasul (user: ${credencial.username}, farm: ${credencial.fazenda_id})...`);
        
        const loginResult = await minasulLogin(credencial.username, password);
        const token = loginResult.token;

        // Salvar token em cache
        await db
          .update(integracoesCredenciaisTable)
          .set({ access_token: token, updated_at: new Date().toISOString() })
          .where(eq(integracoesCredenciaisTable.id, credencial.id));

        const today = new Date().toISOString().slice(0, 10);

        const { amostras_novas, vendas_novas } = await syncMinasulVendasPeriodo(
          credencial.fazenda_id,
          token,
          today,
          today
        );

        amostrasCriadas += amostras_novas;
        vendasCriadas += vendas_novas;
      } catch (err) {
        console.error(`[CRON ERROR] ao processar credencial de ${credencial.username}:`, err);
      }
    }

    return c.json({
      success: true,
      message: "Sync do cron executado com sucesso",
      resultados: {
        amostras_novas: amostrasCriadas,
        vendas_novas: vendasCriadas,
      }
    });
  } catch (err: any) {
    console.error("[CRON ERROR]:", err.message);
    return c.json({ error: "Erro na rotina de sincronização do cron", message: err.message }, 500);
  }
});

export default cronRouter;

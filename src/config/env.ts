import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL deve ser uma URL válida de conexão com o PostgreSQL."),
  JWT_SECRET: z.string().min(10, "JWT_SECRET deve ter no mínimo 10 caracteres."),
  CRON_SECRET: z.string().min(10, "CRON_SECRET deve ter no mínimo 10 caracteres."),
  PORT: z.string().default("3001"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY deve ter exatamente 64 caracteres (32 bytes em hex)."),
  FRONTEND_URL: z.string().url().optional().describe("Domínio do frontend em produção. Opcional em desenvolvimento."),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Parsea e valida as variáveis de ambiente. 
// O método .parse() lança um erro síncrono e derruba a aplicação se faltar variáveis obrigatórias.
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ ERRO FATAL: Variáveis de ambiente faltando ou inválidas.");
  console.error(parsedEnv.error.format());
  process.exit(1); // Fail-fast: encerra o processo Node/Bun
}

export const env = parsedEnv.data;

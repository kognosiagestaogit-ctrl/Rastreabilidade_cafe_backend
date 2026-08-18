import { db } from "./client";
import { usuariosTable } from "./schema";
import "dotenv/config";

const SEED_USER = {
  email: "admin@fazendapedranegra.com.br",
  nome: "Administrador",
  password: "admin123",
  role: "admin" as const,
};

async function seedAdmin() {
  console.log("🌱 Iniciando seed do usuário administrador...\n");

  const now = new Date().toISOString();

  try {
    const password_hash = await Bun.password.hash(SEED_USER.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    await db
      .insert(usuariosTable)
      .values({
        id: "admin-001",
        email: SEED_USER.email,
        nome: SEED_USER.nome,
        password_hash,
        role: SEED_USER.role,
        ativo: true,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing();
    
    console.log("✅ Usuário administrador criado com sucesso no banco de dados.");
    console.log("\nDados de acesso:");
    console.log("  E-mail  :", SEED_USER.email);
    console.log("  Senha   :", SEED_USER.password);
    
  } catch (err: any) {
    console.error("❌ Erro durante o seed do admin:");
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
}

seedAdmin();

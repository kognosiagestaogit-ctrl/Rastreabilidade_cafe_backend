import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usuariosTable = pgTable("usuarios", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  password_hash: text("password_hash").notNull().default(""),
  role: text("role").notNull().default("funcionario"), // 'admin' | 'gerente' | 'funcionario'
  ativo: boolean("ativo").notNull().default(true),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config/env";

const connectionString = env.DATABASE_URL;

export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

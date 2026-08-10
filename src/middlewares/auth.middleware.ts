import { Context, Next } from "hono";
import { verify } from "hono/jwt";

const JWT_SECRET =
  process.env.JWT_SECRET || "fazenda_pedra_negra_secret_key_change_in_production";

// Rotas públicas que não exigem autenticação
const PUBLIC_PATHS = ["/ping", "/doc", "/openapi.json", "/api/auth/login"];

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return await next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { error: "Não autorizado", message: "Acesso restrito. Faça login para continuar." },
      401
    );
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verify(token, JWT_SECRET, "HS256");
    c.set("jwtPayload", payload);
    return await next();
  } catch {
    return c.json(
      { error: "Não autorizado", message: "Sua sessão expirou. Por favor, faça login novamente." },
      401
    );
  }
}

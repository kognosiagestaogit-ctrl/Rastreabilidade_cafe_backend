import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";

const swaggerRouter = new Hono();

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Fazenda Pedra Negra API",
    description:
      "API RESTful para a plataforma de gestão da **Fazenda Pedra Negra**.\n\n" +
      "Stack: Hono · Drizzle ORM · PostgreSQL · Bun\n\n" +
      "Todas as rotas `/api/*` (exceto `/api/auth/login`) requerem autenticação via Bearer Token JWT.",
    version: "1.0.0",
    contact: { name: "Fazenda Pedra Negra" },
  },
  servers: [{ url: "http://localhost:3001", description: "Servidor de desenvolvimento local" }],
  tags: [
    { name: "Health", description: "Health check do serviço" },
    { name: "Auth", description: "Autenticação e sessão do usuário" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT retornado pelo endpoint POST /api/auth/login",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Erro de validação" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                path: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@fazendapedranegra.com.br" },
          password: { type: "string", minLength: 4, example: "admin123" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT Token" },
          user: { $ref: "#/components/schemas/UserSafe" },
        },
      },
      UserSafe: {
        type: "object",
        description: "Usuário sem o campo password_hash",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          nome: { type: "string" },
          role: { type: "string", enum: ["admin", "gerente", "funcionario"] },
          ativo: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/ping": {
      get: {
        tags: ["Health"],
        summary: "Ping — verifica se a API está no ar",
        description: "Rota pública de health check. Não requer autenticação.",
        operationId: "ping",
        responses: {
          "200": {
            description: "Serviço operacional",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "Fazenda Pedra Negra API" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login — autenticar usuário",
        description:
          "Autentica um usuário com e-mail e senha. Retorna um JWT e os dados do usuário. " +
          "Inclui throttling exponencial para proteger contra brute-force.",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login realizado com sucesso",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } },
            },
          },
          "400": {
            description: "Erro de validação",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } },
            },
          },
          "401": {
            description: "Credenciais inválidas",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "403": {
            description: "Usuário inativo",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "500": {
            description: "Erro interno",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Me — retorna dados do usuário autenticado",
        description: "Retorna os dados do usuário logado com base no JWT enviado no header Authorization.",
        operationId: "getMe",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Dados do usuário autenticado",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/UserSafe" } },
            },
          },
          "401": {
            description: "Não autenticado / sessão expirada",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "404": {
            description: "Usuário não encontrado",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "500": {
            description: "Erro interno",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },
  },
};

swaggerRouter.get("/openapi.json", (c) => c.json(openApiSpec));
swaggerRouter.get("/doc", swaggerUI({ url: "/openapi.json", title: "Fazenda Pedra Negra — API Docs" }));

export default swaggerRouter;

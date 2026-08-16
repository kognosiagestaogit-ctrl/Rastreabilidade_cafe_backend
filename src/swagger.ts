import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";

const swaggerRouter = new Hono();

// ─── Schemas reutilizáveis ────────────────────────────────────────────────────
const schemas = {
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
  Fazenda: {
    type: "object",
    properties: {
      id: { type: "string" },
      nome: { type: "string" },
      proprietario: { type: "string", nullable: true },
      cooperado_iniciais: { type: "string", nullable: true },
      localizacao: { type: "string", nullable: true },
      observacoes: { type: "string", nullable: true },
      cor: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  FazendaInput: {
    type: "object",
    required: ["nome"],
    properties: {
      nome: { type: "string", example: "Fazenda Pedra Negra" },
      proprietario: { type: "string", nullable: true },
      cooperado_iniciais: { type: "string", nullable: true, example: "FPN" },
      localizacao: { type: "string", nullable: true, example: "Minas Gerais" },
      observacoes: { type: "string", nullable: true },
      cor: { type: "string", nullable: true, example: "emerald" },
    },
  },
  Talhao: {
    type: "object",
    properties: {
      id: { type: "string" },
      fazenda_id: { type: "string" },
      nome: { type: "string" },
      area_hectares: { type: "number", nullable: true },
      variedade: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
  },
  TalhaoInput: {
    type: "object",
    required: ["nome"],
    properties: {
      nome: { type: "string", example: "Talhão A" },
      area_hectares: { type: "number", nullable: true, example: 12.5 },
      variedade: { type: "string", nullable: true, example: "Catucaí" },
    },
  },
  Lote: {
    type: "object",
    properties: {
      id: { type: "string" },
      fazenda_id: { type: "string" },
      talhao_ids: { type: "array", items: { type: "string" } },
      safra: { type: "integer", example: 2026 },
      numero_lote_fazenda: { type: "string" },
      lote_colheita: { type: "string", nullable: true },
      tipo_cafe: { type: "string", nullable: true },
      colheita_tipo: { type: "string", enum: ["MANUAL", "MECANICA"], nullable: true },
      data_colheita_inicio: { type: "string", format: "date", nullable: true },
      data_colheita_fim: { type: "string", format: "date", nullable: true },
      status: {
        type: "string",
        enum: ["EM_COLHEITA", "NO_TERREIRO", "NO_SECADOR", "NA_TULHA", "BENEFICIADO", "ENVIADO_COOPERATIVA"],
      },
      data_entrada_terreiro: { type: "string", format: "date", nullable: true },
      data_saida_terreiro: { type: "string", format: "date", nullable: true },
      data_entrada_secador: { type: "string", format: "date", nullable: true },
      data_saida_secador: { type: "string", format: "date", nullable: true },
      umidade: { type: "number", nullable: true },
      numero_tulha: { type: "string", nullable: true },
      data_beneficio: { type: "string", format: "date", nullable: true },
      data_envio_cooperativa: { type: "string", format: "date", nullable: true },
      numero_sacas: { type: "number", nullable: true },
      numero_lote_cooperativa: { type: "string", nullable: true },
      nf_remessa_cooperativa: { type: "string", nullable: true },
      observacoes: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  LoteInput: {
    type: "object",
    required: ["fazenda_id", "safra", "numero_lote_fazenda"],
    properties: {
      fazenda_id: { type: "string" },
      talhao_ids: { type: "array", items: { type: "string" } },
      safra: { type: "integer", example: 2026 },
      numero_lote_fazenda: { type: "string", example: "100" },
      lote_colheita: { type: "string", nullable: true },
      tipo_cafe: { type: "string", nullable: true, example: "NATURAL" },
      colheita_tipo: { type: "string", enum: ["MANUAL", "MECANICA"], nullable: true },
      data_colheita_inicio: { type: "string", format: "date", nullable: true },
      status: { type: "string", enum: ["EM_COLHEITA", "NO_TERREIRO", "NO_SECADOR", "NA_TULHA", "BENEFICIADO", "ENVIADO_COOPERATIVA"] },
      numero_sacas: { type: "number", nullable: true },
    },
  },
  Venda: {
    type: "object",
    properties: {
      id: { type: "string" },
      fazenda_id: { type: "string" },
      lote_id: { type: "string", nullable: true },
      numero_lote_cooperativa: { type: "string", nullable: true },
      cliente: { type: "string", nullable: true },
      nf_venda: { type: "string", nullable: true },
      sacas_vendidas: { type: "number" },
      tipo_venda: { type: "string", enum: ["CPR", "TERMO", "FISICA"], nullable: true },
      data_venda: { type: "string", format: "date", nullable: true },
      vl_bruto: { type: "number", nullable: true },
      vl_liquido: { type: "number", nullable: true },
      a_receber_previsto: { type: "number", nullable: true },
      valor_recebido: { type: "number", nullable: true },
      data_recebimento: { type: "string", format: "date", nullable: true },
      premio_rainforest: { type: "number", nullable: true },
      status: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  VendaInput: {
    type: "object",
    required: ["fazenda_id", "sacas_vendidas"],
    properties: {
      fazenda_id: { type: "string" },
      lote_id: { type: "string", nullable: true },
      cliente: { type: "string", nullable: true },
      sacas_vendidas: { type: "number", example: 50 },
      tipo_venda: { type: "string", enum: ["CPR", "TERMO", "FISICA"], nullable: true },
      data_venda: { type: "string", format: "date", nullable: true },
      vl_bruto: { type: "number", nullable: true },
      vl_liquido: { type: "number", nullable: true },
      status: { type: "string", nullable: true },
    },
  },
  Integracao: {
    type: "object",
    properties: {
      id: { type: "string" },
      provider: { type: "string", enum: ["minasul"] },
      username: { type: "string" },
      has_credentials: { type: "boolean", example: true },
      last_sync_at: { type: "string", format: "date-time", nullable: true },
      status: { type: "string", enum: ["ATIVO", "ERRO", "DESATIVADO"] },
      error_message: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  IntegracaoInput: {
    type: "object",
    required: ["provider", "username", "password"],
    properties: {
      provider: { type: "string", enum: ["minasul"], example: "minasul" },
      username: { type: "string", example: "1427" },
      password: { type: "string", example: "*****" },
    },
  },
  SyncResponse: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      provider: { type: "string" },
      periodo: {
        type: "object",
        properties: {
          dateIni: { type: "string", format: "date" },
          dateEnd: { type: "string", format: "date" },
        },
      },
      total_vendas: { type: "integer" },
      vendas: { type: "array", items: { type: "object" } },
    },
  },
  SyncDetalhesInput: {
    type: "object",
    required: ["salesId", "coopBatchId"],
    properties: {
      salesId: { type: "string", example: "AM-00311777" },
      coopBatchId: { type: "string", example: "26270100028" },
    },
  },
  DashboardMetricas: {
    type: "object",
    properties: {
      total_sacas_produzidas: { type: "number", example: 1200 },
      total_sacas_vendidas: { type: "number", example: 850 },
      total_faturado: { type: "number", example: 980500.50 },
      total_a_receber: { type: "number", example: 350000.00 },
    },
  },
};

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Fazenda Pedra Negra API",
    description:
      "API RESTful para a plataforma de gestão da **Fazenda Pedra Negra**.\n\n" +
      "Stack: Hono · Drizzle ORM · PostgreSQL · Bun\n\n" +
      "Todas as rotas `/api/*` (exceto `/api/auth/login`) requerem autenticação via Bearer Token JWT.",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:3001", description: "Desenvolvimento local" }],
  tags: [
    { name: "Health", description: "Health check" },
    { name: "Auth", description: "Autenticação" },
    { name: "Fazendas", description: "Gestão de fazendas" },
    { name: "Dashboard", description: "Métricas agregadas" },
    { name: "Talhões", description: "Talhões de uma fazenda" },
    { name: "Lotes", description: "Lotes de café" },
    { name: "Vendas", description: "Vendas de café" },
    { name: "Integrações", description: "Integrações com sistemas externos (Minasul, etc.)" },
    { name: "Cron", description: "Rotinas automatizadas de sincronização" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas,
  },
  paths: {
    // ── Health ────────────────────────────────────────────────────────────────
    "/ping": {
      get: {
        tags: ["Health"],
        summary: "Ping",
        operationId: "ping",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        operationId: "login",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          "401": { description: "Credenciais inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Usuário logado",
        operationId: "getMe",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/UserSafe" } } } },
          "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Fazendas ──────────────────────────────────────────────────────────────
    "/api/fazendas": {
      get: {
        tags: ["Fazendas"],
        summary: "Listar fazendas",
        operationId: "getFazendas",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Fazenda" } } } } },
        },
      },
      post: {
        tags: ["Fazendas"],
        summary: "Criar fazenda",
        operationId: "createFazenda",
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/FazendaInput" } } } },
        responses: {
          "201": { description: "Criada", content: { "application/json": { schema: { $ref: "#/components/schemas/Fazenda" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/api/fazendas/{id}": {
      get: {
        tags: ["Fazendas"],
        summary: "Buscar fazenda por ID",
        operationId: "getFazendaById",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Fazenda" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Fazendas"],
        summary: "Atualizar fazenda",
        operationId: "updateFazenda",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/FazendaInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Fazenda" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Fazendas"],
        summary: "Remover fazenda (cascata em lotes e vendas)",
        operationId: "deleteFazenda",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Removida" },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Talhões ───────────────────────────────────────────────────────────────
    "/api/fazendas/{fazendaId}/talhoes": {
      get: {
        tags: ["Talhões"],
        summary: "Listar talhões de uma fazenda",
        operationId: "getTalhoes",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "fazendaId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Talhao" } } } } },
        },
      },
      post: {
        tags: ["Talhões"],
        summary: "Criar talhão",
        operationId: "createTalhao",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "fazendaId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TalhaoInput" } } } },
        responses: {
          "201": { description: "Criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Talhao" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/api/talhoes/{id}": {
      delete: {
        tags: ["Talhões"],
        summary: "Remover talhão",
        operationId: "deleteTalhao",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Removido" },
          "404": { description: "Não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Lotes ─────────────────────────────────────────────────────────────────
    "/api/fazendas/{fazendaId}/lotes": {
      get: {
        tags: ["Lotes"],
        summary: "Listar lotes de uma fazenda",
        operationId: "getLotes",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "fazendaId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Lote" } } } } },
        },
      },
    },
    "/api/lotes": {
      post: {
        tags: ["Lotes"],
        summary: "Criar lote",
        operationId: "createLote",
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoteInput" } } } },
        responses: {
          "201": { description: "Criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Lote" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/api/lotes/{id}": {
      get: {
        tags: ["Lotes"],
        summary: "Buscar lote por ID",
        operationId: "getLoteById",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Lote" } } } },
          "404": { description: "Não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Lotes"],
        summary: "Atualizar lote",
        operationId: "updateLote",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoteInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Lote" } } } },
          "404": { description: "Não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Lotes"],
        summary: "Remover lote",
        operationId: "deleteLote",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Removido" },
          "404": { description: "Não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Vendas ────────────────────────────────────────────────────────────────
    "/api/fazendas/{fazendaId}/vendas": {
      get: {
        tags: ["Vendas"],
        summary: "Listar vendas de uma fazenda",
        operationId: "getVendas",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "fazendaId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Venda" } } } } },
        },
      },
    },
    "/api/vendas": {
      post: {
        tags: ["Vendas"],
        summary: "Criar venda",
        operationId: "createVenda",
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VendaInput" } } } },
        responses: {
          "201": { description: "Criada", content: { "application/json": { schema: { $ref: "#/components/schemas/Venda" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/api/vendas/{id}": {
      get: {
        tags: ["Vendas"],
        summary: "Buscar venda por ID",
        operationId: "getVendaById",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Venda" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Vendas"],
        summary: "Atualizar venda",
        operationId: "updateVenda",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VendaInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Venda" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Vendas"],
        summary: "Remover venda",
        operationId: "deleteVenda",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Removida" },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Integrações ───────────────────────────────────────────────────────────
    "/api/integracoes": {
      get: {
        tags: ["Integrações"],
        summary: "Listar integrações configuradas",
        operationId: "getIntegracoes",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Integracao" } } } } },
        },
      },
      post: {
        tags: ["Integrações"],
        summary: "Salvar credenciais de integração (senha criptografada)",
        operationId: "createIntegracao",
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/IntegracaoInput" } } } },
        responses: {
          "201": { description: "Criada", content: { "application/json": { schema: { $ref: "#/components/schemas/Integracao" } } } },
          "400": { description: "Validação", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/api/integracoes/{id}": {
      get: {
        tags: ["Integrações"],
        summary: "Buscar integração por ID",
        operationId: "getIntegracaoById",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Integracao" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Integrações"],
        summary: "Atualizar credenciais de integração",
        operationId: "updateIntegracao",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/IntegracaoInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Integracao" } } } },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Integrações"],
        summary: "Remover integração",
        operationId: "deleteIntegracao",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Removida" },
          "404": { description: "Não encontrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/crons/sync-minasul-vendas": {
      post: {
        tags: ["Cron"],
        summary: "Executa rotina automática do Cron para sincronismo da Minasul",
        description: "Faz login usando a credencial 1 da Minasul, busca vendas do dia e cadastra amostras e vendas relacionadas.",
        operationId: "cronSyncMinasul",
        parameters: [
          {
            name: "Authorization",
            in: "header",
            description: "Token Bearer contendo o CRON_SECRET",
            required: true,
            schema: {
              type: "string",
              example: "Bearer desenvolvimento_local_secret",
            },
          },
        ],
        responses: {
          "200": {
            description: "Sync do cron executado com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    resultados: {
                      type: "object",
                      properties: {
                        amostras_novas: { type: "integer" },
                        vendas_novas: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Acesso não autorizado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "500": { description: "Erro na rotina de sincronização do cron", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};

swaggerRouter.get("/openapi.json", (c) => c.json(openApiSpec));
swaggerRouter.get("/doc", swaggerUI({ url: "/openapi.json", title: "Fazenda Pedra Negra — API Docs" }));

export default swaggerRouter;

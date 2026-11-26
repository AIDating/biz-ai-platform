import { basePrisma } from "@/lib/db";

/**
 * Models that belong to a business. Every operation on these models goes
 * through tenantDb(), which overwrites tenantId. Session and Tenant are
 * intentionally absent: login looks up a user by email, then all business
 * data is read with the tenant id from that session.
 */
const GUARDED = new Set([
  "User",
  "AgentProfile",
  "AvailabilityRule",
  "Visitor",
  "Conversation",
  "Message",
  "Lead",
  "Appointment",
  "Integration",
  "ContentProposal",
  "AiVideoJob",
]);

const BLOCKED = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * Prisma client that refuses to touch business data unless a tenant id is
 * supplied, then forces that id onto the query. Callers cannot widen it.
 */
export function tenantDb(tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new TenantScopeError("A tenant id is required.");
  }

  return basePrisma.$extends({
    name: `tenant:${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!GUARDED.has(model)) {
            throw new TenantScopeError(
              `${model} is not available on the tenant client.`,
            );
          }
          if (BLOCKED.has(operation)) {
            throw new TenantScopeError(
              `${model}.${operation} is disabled. Use findFirst, updateMany, or deleteMany so the tenant filter cannot be skipped.`,
            );
          }
          const next = scopeArgs(operation, args as QueryArgs, tenantId);
          return query(next);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantDb>;

function scopeArgs(operation: string, args: QueryArgs, tenantId: string) {
  if (operation === "create") {
    const data = record(args.data);
    return { ...args, data: { ...data, tenantId } };
  }

  if (operation === "createMany") {
    const rows = Array.isArray(args.data) ? args.data : [record(args.data)];
    return {
      ...args,
      data: rows.map((row) => ({ ...row, tenantId })),
    };
  }

  const where = { ...(args.where ?? {}), tenantId };
  if (args.data && !Array.isArray(args.data)) {
    const data = { ...args.data };
    delete data.tenantId;
    return { ...args, where, data };
  }
  return { ...args, where };
}

function record(value: QueryArgs["data"]): Record<string, unknown> {
  if (!value || Array.isArray(value)) return {};
  return value;
}

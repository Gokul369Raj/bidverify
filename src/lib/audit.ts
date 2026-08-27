import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import type { SessionUser } from "@/lib/auth";

export interface AuditInput {
  actor?: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string | null;
}

/** Append-only audit trail. Never throws — auditing must not break the request path. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.userId ?? null,
        actorEmail: input.actor?.email ?? "system",
        actorRole: input.actor?.role ?? "SYSTEM",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeJson: input.before === undefined ? undefined : toJson(input.before),
        afterJson: input.after === undefined ? undefined : toJson(input.after),
        reason: input.reason ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

/** Role model — enforced on the backend for every request. Frontend role values are never trusted. */

export const ROLES = [
  "SUPER_ADMIN",
  "PROCUREMENT_OFFICER",
  "BID_EVALUATION_OFFICER",
  "COMPLIANCE_REVIEWER",
  "AUDITOR",
  "SYSTEM_ADMIN",
  "BIDDER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  PROCUREMENT_OFFICER: "Procurement Officer",
  BID_EVALUATION_OFFICER: "Bid Evaluation Officer",
  COMPLIANCE_REVIEWER: "Compliance Reviewer",
  AUDITOR: "Auditor",
  SYSTEM_ADMIN: "System Administrator",
  BIDDER: "Bidder",
};

/** Officer-side roles that may access the /officer portal. */
export const OFFICER_ROLES: Role[] = [
  "SUPER_ADMIN",
  "PROCUREMENT_OFFICER",
  "BID_EVALUATION_OFFICER",
  "COMPLIANCE_REVIEWER",
  "AUDITOR",
  "SYSTEM_ADMIN",
];

/** Roles allowed to create/modify tenders and record decisions. */
export const DECISION_ROLES: Role[] = ["SUPER_ADMIN", "PROCUREMENT_OFFICER", "BID_EVALUATION_OFFICER"];

/** Roles allowed to administer platform settings, rules and users. */
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "SYSTEM_ADMIN"];

/** Read-only audit visibility. */
export const AUDIT_ROLES: Role[] = ["SUPER_ADMIN", "AUDITOR", "SYSTEM_ADMIN", "PROCUREMENT_OFFICER"];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** Coerce arbitrary input (DB string, JWT claim) to a Role, defaulting safely to BIDDER. */
export function safeRole(v: unknown): Role {
  return isRole(v) ? v : "BIDDER";
}

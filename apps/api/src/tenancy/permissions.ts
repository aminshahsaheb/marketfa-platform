export type TenantRole =
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "ACCOUNTANT"
  | "VIEWER";

export type Permission =
  | "tenant:manage"
  | "members:manage"
  | "catalog:read"
  | "catalog:write"
  | "purchasing:write"
  | "inventory:read"
  | "inventory:write"
  | "pos:sell"
  | "pos:discount"
  | "refund:request"
  | "refund:approve"
  | "shift:operate"
  | "shift:manage"
  | "ledger:read"
  | "journal:draft"
  | "journal:approve"
  | "period:close"
  | "reports:read"
  | "reports:financial"
  | "backup:manage";

const rolePermissions: Readonly<Record<TenantRole, ReadonlySet<Permission>>> = {
  OWNER: new Set([
    "tenant:manage",
    "members:manage",
    "catalog:read",
    "catalog:write",
    "purchasing:write",
    "inventory:read",
    "inventory:write",
    "pos:sell",
    "pos:discount",
    "refund:request",
    "refund:approve",
    "shift:operate",
    "shift:manage",
    "ledger:read",
    "journal:draft",
    "journal:approve",
    "period:close",
    "reports:read",
    "reports:financial",
    "backup:manage"
  ]),
  MANAGER: new Set([
    "catalog:read",
    "catalog:write",
    "purchasing:write",
    "inventory:read",
    "inventory:write",
    "pos:sell",
    "pos:discount",
    "refund:request",
    "refund:approve",
    "shift:operate",
    "shift:manage",
    "reports:read"
  ]),
  CASHIER: new Set([
    "catalog:read",
    "pos:sell",
    "refund:request",
    "shift:operate"
  ]),
  ACCOUNTANT: new Set([
    "ledger:read",
    "journal:draft",
    "reports:read",
    "reports:financial"
  ]),
  VIEWER: new Set(["catalog:read", "inventory:read", "reports:read"])
};

export function hasPermission(
  role: TenantRole,
  permission: Permission
): boolean {
  return rolePermissions[role].has(permission);
}

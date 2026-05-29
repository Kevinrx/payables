/**
 * Role/permission seam.
 *
 * The app is single-tenant demo today (no auth, no per-user roles). Ramp gates
 * allocation-template management to Admin and Accounts-Payable roles, while
 * approvers may apply splits but not save templates. We model that boundary
 * here so callers (server actions + UI) can branch on it now, and so the only
 * thing that changes when real auth lands is the body of these functions.
 *
 * Until then, the demo org behaves as an admin: template management is allowed.
 */

/** Whether the current actor may create/edit/delete saved allocation templates. */
export function canManageTemplates(orgId: string): boolean {
  void orgId; // TODO(auth): resolve the actor's role for this org and return
  // role === "admin" || role === "accounts_payable".
  return true;
}

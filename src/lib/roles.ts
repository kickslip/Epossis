/** Human-facing role labels. SUPER_ADMIN renders as "Admin" — the platform
 * operator IS the app admin; ADMIN (tenant-scoped) renders as "Manager". */
export function roleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Admin'
    case 'ADMIN': return 'Manager'
    case 'STAFF': return 'Staff'
    default: return role
  }
}

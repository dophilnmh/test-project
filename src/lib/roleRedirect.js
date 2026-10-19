export const ROLE_HOME = {
  superadmin: '/admin',
  admin: '/admin',
  organizer: '/organizer',
  finance: '/finance',
  member: '/member',
  user: '/events',
};

const PATH_RULES = [
  { prefix: '/admin', roles: ['superadmin', 'admin'] },
  { prefix: '/organizer', roles: ['superadmin', 'admin', 'organizer'] },
  { prefix: '/finance', roles: ['superadmin', 'admin', 'finance'] },
  { prefix: '/member', roles: ['superadmin', 'admin', 'member'] },
];

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/events';
}

export function getRequiredRoles(pathname) {
  const matched = PATH_RULES.find((rule) => pathname.startsWith(rule.prefix));
  return matched ? matched.roles : null;
}

export function canAccessPath(role, pathname) {
  const required = getRequiredRoles(pathname);
  if (!required) return true;
  return required.includes(role);
}

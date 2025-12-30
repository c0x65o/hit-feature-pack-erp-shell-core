import { NextRequest } from 'next/server';

export interface User {
  sub: string;
  email: string;
  name?: string;
  roles?: string[];
  groups?: string[];
  // Optional feature pack config carried in JWT claims (app-controlled).
  featurePacks?: Record<string, any>;
}

/**
 * Extract user from JWT token in cookies or Authorization header
 * Also checks x-user-id header (set by proxy/middleware in production)
 */
export function extractUserFromRequest(request: NextRequest): User | null {
  // Check for token in cookie first
  let token = request.cookies.get('hit_token')?.value;

  // Fall back to Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // Always try to extract from JWT first (so we keep roles/groups/email when present)
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));

      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }

      const groupIdsRaw =
        payload.groupIds ?? payload.group_ids ?? payload.group_ids_list ?? payload.groups ?? payload.group_ids_csv;
      const groups = Array.isArray(groupIdsRaw)
        ? groupIdsRaw.map((g: unknown) => String(g)).map((g: string) => g.trim()).filter(Boolean)
        : typeof groupIdsRaw === 'string'
          ? groupIdsRaw
              .split(',')
              .map((g: string) => g.trim())
              .filter(Boolean)
          : [];

      return {
        sub: payload.sub || payload.email || '',
        email: payload.email || '',
        name: payload.name || payload.email || '',
        roles: payload.roles || [],
        groups,
        featurePacks: (payload.featurePacks && typeof payload.featurePacks === 'object') ? payload.featurePacks : undefined,
      };
    } catch {
      // JWT parsing failed, fall through to x-user-* headers
    }
  }

  // Fall back to x-user-* headers (set by proxy in production)
  const xUserId = request.headers.get('x-user-id');
  if (xUserId) {
    const xUserEmail = request.headers.get('x-user-email') || '';
    const xUserName = request.headers.get('x-user-name') || xUserEmail || '';
    const xUserRoles = request.headers.get('x-user-roles');
    const roles = xUserRoles ? xUserRoles.split(',').map((r) => r.trim()).filter(Boolean) : [];

    const xUserGroupIds = request.headers.get('x-user-group-ids') || request.headers.get('x-user-groups');
    const groups = xUserGroupIds
      ? xUserGroupIds
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)
      : [];

    return { sub: xUserId, email: xUserEmail, name: xUserName, roles, groups };
  }

  return null;
}

/**
 * Extract user ID from request (convenience function)
 */
export function getUserId(request: NextRequest): string | null {
  const user = extractUserFromRequest(request);
  return user?.sub || null;
}


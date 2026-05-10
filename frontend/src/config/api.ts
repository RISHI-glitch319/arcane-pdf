const rawApiBase = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

export const API_BASE = rawApiBase.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

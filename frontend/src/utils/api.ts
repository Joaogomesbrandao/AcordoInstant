function normalizeBaseUrl(value?: string): string {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return '';
  }

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);

export function apiUrl(path: string): string {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

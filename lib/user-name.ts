export function firstName(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.split(' ')[0] || null;
}

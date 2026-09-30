/** Detecta intención de comparar un enlace, sin sustituir la validación del endpoint. */
export function normalizeLinkInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^www\.[^\s]+$/i.test(trimmed)) return `https://${trimmed}`;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  return null;
}

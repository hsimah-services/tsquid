export type Field = { kind: string; optional: boolean };
export type URI<I> = ReturnType<typeof createURI<I>>;

/** Repeated query keys encode collections. Missing optional fields remain undefined. */
export function createURI<I>(path: string, fields: Record<string, Field>) {
  const parts = normalizePathname(path).split('/');
  const pathKeys = new Set(parts.filter(p => p.startsWith(':')).map(p => p.slice(1)));
  function parseURI(uri: string): I {
    const url = new URL(uri, 'http://tsquid.local');
    const segments = normalizePathname(url.pathname).split('/');
    if (segments.length !== parts.length) throw new Error(`URI does not match ${path}`);
    const raw: Record<string, string[]> = Object.create(null);
    parts.forEach((part, index) => {
      if (part.startsWith(':')) {
        if (!segments[index]) throw new Error('Empty path segment');
        raw[part.slice(1)] = [decodeURIComponent(segments[index])];
      }
      else if (part !== segments[index]) throw new Error(`URI does not match ${path}`);
    });
    const result: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      const values = pathKeys.has(key) ? raw[key] : url.searchParams.getAll(key);
      if (!values.length) {
        if (!field.optional) throw new Error(`Missing ${key}`);
        continue;
      }
      const array = field.kind.endsWith('[]');
      if (!array && values.length !== 1) throw new Error(`Duplicate ${key}`);
      const parsed = values.map(value => parseValue(value, field.kind.replace('[]', ''), key));
      result[key] = array ? parsed : parsed[0];
    }
    return result as I;
  }
  function getURI(input: I): string {
    const values = input as Record<string, unknown>;
    const query = new URLSearchParams();
    for (const [key, field] of Object.entries(fields)) {
      const value = values[key];
      if (value === undefined) {
        if (!field.optional) throw new Error(`Missing ${key}`);
        continue;
      }
      const array = field.kind.endsWith('[]');
      if (Array.isArray(value) !== array) throw new Error(`Invalid ${key}`);
      if (array && !(value as unknown[]).length && !field.optional) throw new Error(`Empty required collection ${key}`);
      for (const item of array ? value as unknown[] : [value]) {
        const kind = field.kind.replace('[]', '');
        if (typeof item !== (kind === 'int' ? 'number' : kind === 'bool' ? 'boolean' : 'string')) throw new Error(`Invalid ${key}`);
        parseValue(String(item), kind, key);
        if (!pathKeys.has(key)) query.append(key, String(item));
      }
    }
    const pathname = parts.map(part => {
      if (!part.startsWith(':')) return part;
      const value = String(values[part.slice(1)]);
      if (!value || value === '.' || value === '..') throw new Error('Invalid path segment');
      return encodeURIComponent(value);
    }).join('/');
    return pathname + (query.size ? `?${query}` : '');
  }
  return { path, parseURI, getURI };
}
function parseValue(value: string, kind: string, key: string): string | number | boolean {
  if (kind === 'string') return value;
  if (kind === 'bool' && (value === 'true' || value === 'false')) return value === 'true';
  if (kind === 'int' && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
  throw new Error(`Invalid ${kind} for ${key}`);
}

/** Ignore trailing separators without decoding IDs or changing interior segments. */
export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

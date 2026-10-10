import type { FetchFunction, GraphQLResponse, Variables } from 'relay-runtime';

/** The server inlines this as JSON in `<script type="application/json" id="tsquid-data">`. */
export type InitialData = {
  version: 1;
  responses: { operation: string; variables: Variables; response: GraphQLResponse }[];
};

/** Reads `#tsquid-data`. Null when the page has none; throws when it is malformed. */
export function readInitialData(id = 'tsquid-data'): InitialData | null {
  if (typeof document === 'undefined') return null;
  const element = document.getElementById(id);
  if (!element) return null;
  const data: unknown = JSON.parse(element.textContent ?? '');
  if (!isInitialData(data)) throw new Error(`Invalid #${id} payload`);
  return data;
}

/**
 * Answers each matching request (operation name + variables) once, synchronously, so
 * the initial route renders without suspending. Entries expire after the first
 * request's task; `warn` reports misses during it and entries left unused.
 */
export function withInitialData(fetchFn: FetchFunction, data: InitialData | null, options: { warn?: boolean } = {}): FetchFunction {
  if (!data) return fetchFn;
  const pending = new Map<string, GraphQLResponse>();
  for (const { operation, variables, response } of data.responses) {
    const key = getKey(operation, variables);
    if (pending.has(key)) throw new Error(`Duplicate initial data for ${key}`);
    pending.set(key, response);
  }
  const used = new Set<string>();
  let state: 'waiting' | 'booting' | 'done' = 'waiting';
  return (request, variables, ...rest) => {
    if (state === 'waiting') {
      state = 'booting';
      setTimeout(() => {
        state = 'done';
        if (options.warn) pending.forEach((_, key) => console.warn(`tsquid-data: unused response for ${key}`));
        pending.clear();
      }, 0);
    }
    if (state === 'booting') {
      const key = getKey(request.name, variables);
      const response = pending.get(key);
      if (response) {
        pending.delete(key);
        used.add(key);
        return response;
      }
      if (options.warn && !used.has(key)) console.warn(`tsquid-data: no response for ${key}`);
    }
    return fetchFn(request, variables, ...rest);
  };
}

// Relay sends every declared variable, null when unset with no default, so top-level
// nulls are dropped. Object keys are sorted: the server needn't match key order.
function getKey(operation: string, variables: Variables): string {
  const set = Object.fromEntries(Object.entries(variables).filter(([, value]) => value != null));
  return operation + ' ' + JSON.stringify(set, (_, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : value);
}

function isInitialData(data: unknown): data is InitialData {
  return isObject(data) && data.version === 1 && Array.isArray(data.responses) && data.responses.every(entry =>
    isObject(entry) && typeof entry.operation === 'string' && isObject(entry.variables) && !Array.isArray(entry.variables)
    && typeof entry.response === 'object' && entry.response !== null);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

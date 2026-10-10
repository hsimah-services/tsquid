/**
 * Validates a routes.json document and returns the generated TypeScript module. Throws on an invalid config.
 * `persistedQueries` is the content of the Relay persisted-queries file the config names, if any.
 */
export declare function generate(config: string, persistedQueries?: string | null): string;
/** Validates like generate() and returns the server manifest (JSON): every route, its ssr flag and query. */
export declare function manifest(config: string, persistedQueries?: string | null): string;

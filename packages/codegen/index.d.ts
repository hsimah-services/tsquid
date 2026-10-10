/** Validates a routes.json document and returns the generated TypeScript module. Throws on an invalid config. */
export declare function generate(config: string): string;
/** Validates a routes.json document and returns the server manifest (JSON): every route, with its ssr flag. Throws on an invalid config. */
export declare function manifest(config: string): string;

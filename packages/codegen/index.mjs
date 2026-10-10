import { readFileSync } from 'node:fs';

const WASM = new URL('./dist/tsquid-codegen.wasm', import.meta.url);
let exports;

/**
 * Validates a routes.json document and returns the generated TypeScript module.
 * `persistedQueries` is the content of the file the config names, if any.
 */
export function generate(config, persistedQueries = null) {
  return call('generate', config, persistedQueries);
}

/** Validates like generate() and returns the server manifest (JSON). */
export function manifest(config, persistedQueries = null) {
  return call('manifest', config, persistedQueries);
}

function call(name, config, persistedQueries) {
  exports ??= new WebAssembly.Instance(new WebAssembly.Module(readFileSync(WASM))).exports;
  const input = new TextEncoder().encode(JSON.stringify({ config, persistedQueries }));
  const ptr = exports.alloc(input.length);
  new Uint8Array(exports.memory.buffer, ptr, input.length).set(input);
  const ok = exports[name](ptr, input.length);
  exports.dealloc(ptr, input.length);
  // Views are taken after each call: growing memory detaches earlier buffers.
  const result = new TextDecoder().decode(new Uint8Array(exports.memory.buffer, exports.result_ptr(), exports.result_len()));
  if (!ok) throw new Error(result);
  return result;
}

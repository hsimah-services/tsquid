import { readFileSync } from 'node:fs';

const WASM = new URL('./dist/tsquid-codegen.wasm', import.meta.url);
let exports;

/** Validates a routes.json document and returns the generated TypeScript module. */
export function generate(config) {
  return call('generate', config);
}

/** Validates a routes.json document and returns the server manifest (JSON): every route, with its ssr flag. */
export function manifest(config) {
  return call('manifest', config);
}

function call(name, config) {
  exports ??= new WebAssembly.Instance(new WebAssembly.Module(readFileSync(WASM))).exports;
  const input = new TextEncoder().encode(config);
  const ptr = exports.alloc(input.length);
  new Uint8Array(exports.memory.buffer, ptr, input.length).set(input);
  const ok = exports[name](ptr, input.length);
  exports.dealloc(ptr, input.length);
  // Views are taken after each call: growing memory detaches earlier buffers.
  const result = new TextDecoder().decode(new Uint8Array(exports.memory.buffer, exports.result_ptr(), exports.result_len()));
  if (!ok) throw new Error(result);
  return result;
}

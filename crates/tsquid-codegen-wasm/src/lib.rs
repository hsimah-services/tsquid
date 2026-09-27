//! The generator as a WebAssembly module for @tsquid/codegen. The host owns all I/O:
//! it copies the config into memory from `alloc`, calls `generate`, then reads the
//! output (or error message) from `result_ptr`/`result_len`.
use std::cell::RefCell;

thread_local! {
    static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

/// # Safety
/// `ptr` and `len` must come from one `alloc` call and be released once.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len));
}

/// Returns 1 when the result holds generated TypeScript, 0 when it holds an error.
///
/// # Safety
/// `ptr` must point to `len` initialized bytes.
#[no_mangle]
pub unsafe extern "C" fn generate(ptr: *const u8, len: usize) -> u32 {
    let input = std::slice::from_raw_parts(ptr, len);
    let result = std::str::from_utf8(input)
        .map_err(|error| error.to_string())
        .and_then(tsquid_codegen::generate_json);
    let (ok, text) = match result {
        Ok(output) => (1, output),
        Err(error) => (0, error),
    };
    RESULT.with(|result| *result.borrow_mut() = text.into_bytes());
    ok
}

#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    RESULT.with(|result| result.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn result_len() -> usize {
    RESULT.with(|result| result.borrow().len())
}

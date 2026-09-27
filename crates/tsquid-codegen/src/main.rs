use std::{env, fs, path::Path};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() < 2 || args.len() > 3 || (args.len() == 3 && args[2] != "--check") {
        return Err("Usage: tsquid-codegen CONFIG.json OUTPUT.ts [--check]".into());
    }
    let output = tsquid_codegen::generate_json(&fs::read_to_string(&args[0])?)?;
    if args.len() == 3 {
        if fs::read_to_string(&args[1]).ok().as_deref() != Some(&output) {
            return Err("Generated routes are stale; regenerate them".into());
        }
    } else {
        if let Some(parent) = Path::new(&args[1])
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
        {
            fs::create_dir_all(parent)?;
        }
        fs::write(&args[1], output)?;
    }
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

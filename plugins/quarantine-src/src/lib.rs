//! Extism WASI 0.2 quarantine plugin for the X402 ZK Mesh.
//!
//! Exported function `validate` receives the normalized (lowercased JSON)
//! foreign payload and returns `{ "safe": bool, "reason"?: string }`.
//!
//! This runs inside the Extism WASM sandbox with zero filesystem and zero
//! network access (the host pins `allowedPaths: {}` and `allowedHosts: []`),
//! so a malicious payload cannot escape even if the ruleset misses it.

use extism_pdk::*;
use serde::Serialize;

#[derive(Serialize)]
pub struct Verdict {
    pub safe: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub engine: &'static str,
}

/// 32 banned patterns across shell escapes, code-exec, prototype pollution,
/// SSRF/exfil and path traversal. Kept in sync with the TS heuristic fallback.
const BANNED_TOKENS: &[&str] = &[
    // shell / process escapes
    "bash", "/bin/sh", "/bin/bash", "sh -c", "nc -e", "rm -rf", "mkfifo",
    "system(", "exec(", "execsync", "child_process", "spawn(", "popen(",
    // code evaluation
    "eval(", "require(", "import(", "function(", "<system>", "settimeout(\"",
    // node / runtime internals
    "process.env", "fs.", "globalthis", "__dirname", "module.exports",
    // prototype pollution
    "__proto__", "constructor[", "prototype[",
    // network exfiltration / SSRF
    "curl ", "wget ", "http://169.254", "file://", "://localhost",
    // path traversal
    "../../", "..\\..\\",
];

#[plugin_fn]
pub fn validate(input: String) -> FnResult<Json<Verdict>> {
    let haystack = input.to_lowercase();

    for token in BANNED_TOKENS {
        if haystack.contains(token) {
            return Ok(Json(Verdict {
                safe: false,
                reason: Some(format!("banned token detected: {token}")),
                engine: "extism_wasm",
            }));
        }
    }

    Ok(Json(Verdict {
        safe: true,
        reason: None,
        engine: "extism_wasm",
    }))
}

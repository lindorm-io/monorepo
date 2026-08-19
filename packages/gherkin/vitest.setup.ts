// swc's 2022-03 decorator lowering only creates `context.metadata` when
// `Symbol.metadata` exists, so the polyfill must run before any decorated
// test fixture evaluates.
import "./src/internal/polyfill-symbol-metadata.js";

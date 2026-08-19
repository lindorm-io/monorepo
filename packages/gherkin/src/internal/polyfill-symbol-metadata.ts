import { isUndefined } from "@lindorm/is";

// `Symbol.metadata` is absent in current Node (measured undefined on v25.6.1
// — guard for it, never version-gate), but decorator lowering (tsc's
// `__esDecorate`, swc's 2022-03 output) only creates `context.metadata` when
// the symbol exists — otherwise every metadata-backed decorator throws.
// Register the symbol in the global registry so the shim stays consistent
// across packages that also ship their own guard.
if (isUndefined((Symbol as { metadata?: symbol }).metadata)) {
  (Symbol as { metadata?: symbol }).metadata = Symbol.for("Symbol.metadata");
}

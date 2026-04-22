// Node < 26 does not expose `Symbol.metadata`, but `__esDecorate` (emitted by
// tsc when lowering TC39 stage-3 decorators) only creates `context.metadata`
// when the symbol exists — otherwise it passes `undefined` and every
// metadata-backed decorator throws `Cannot convert undefined or null to
// object`. Register the symbol in the global registry so the shim stays
// consistent across packages that also ship their own guard.
if (typeof (Symbol as { metadata?: symbol }).metadata === "undefined") {
  (Symbol as { metadata?: symbol }).metadata = Symbol.for("Symbol.metadata");
}

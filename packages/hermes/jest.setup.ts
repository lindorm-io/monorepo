// Polyfill Symbol.metadata for TC39 decorators (Stage 3).
// TypeScript's compiled decorator output conditionally creates the metadata object
// only when Symbol.metadata exists. Without this polyfill, context.metadata is
// undefined and decorator stage functions throw.
(Symbol as any).metadata ??= Symbol.for("Symbol.metadata");

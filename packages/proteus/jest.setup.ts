// Polyfill Symbol.metadata for stage-3 decorator support in Node.js < 27
// TypeScript stage-3 decorators use Symbol.metadata to store metadata
// on class constructors. Node.js does not yet define Symbol.metadata
// natively, so we polyfill it here for the test environment.
if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol("Symbol.metadata");
}

/**
 * A real Error — never a value that merely LOOKS like one.
 *
 * `instanceof` first because it is the cheap path and answers for everything in
 * this realm, subclasses included. The tag is the fallback for a CROSS-REALM
 * error (a `vm` context, a worker, an iframe), which fails `instanceof` against
 * our own `Error` but still carries `[object Error]` from its internal slot.
 *
 * ⚠ Deliberately NOT duck-typed on `name` + `message`. Ordinary data trips that
 * by accident — a form field, a contact record, a log entry — and a consumer
 * acting on the answer then treats plain data as an error. `Symbol.toStringTag`
 * can still forge the tag, but that takes intent rather than coincidence.
 */
export const isError = (input: any): input is Error =>
  input instanceof Error || Object.prototype.toString.call(input) === "[object Error]";

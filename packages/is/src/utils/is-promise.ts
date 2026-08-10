/**
 * A real Promise — the same shape as {@link isError}: `instanceof` for this
 * realm, the `[object Promise]` tag as the CROSS-REALM fallback.
 *
 * ⚠ This asks whether the value IS a Promise, not whether it is AWAITABLE.
 * They are different questions: `await` adopts any thenable, so
 * `{ then(){} }` is awaitable without being a Promise. The previous
 * `then` + `catch` + `finally` check answered neither — it rejected a bare
 * thenable that `await` accepts, and accepted any object carrying those three
 * method names. Awaitability is `typeof input?.then === "function"` and belongs
 * in its own guard the day something needs it.
 */
export const isPromise = (input?: any): input is Promise<any> =>
  input instanceof Promise ||
  Object.prototype.toString.call(input) === "[object Promise]";

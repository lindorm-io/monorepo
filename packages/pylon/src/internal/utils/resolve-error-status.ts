import { ServerError } from "@lindorm/errors";

/**
 * The status a thrown error becomes. ONE function, because three callers need
 * the same answer and a second copy is a divergence waiting to happen: both
 * error handlers set/log by it, and `useAuditLog` records it — and audit runs
 * BELOW the error handler, so its frame unwinds before `ctx.status` is set and
 * the error object is the only thing it can read the outcome from.
 *
 * A `RedirectError` is deliberately NOT special-cased here. This answers "what
 * error status is this", and the http handler answers a redirect with
 * `ctx.redirect()` instead of a status — that is response behaviour, resolved
 * where the redirect is performed.
 */
export const resolveErrorStatus = (error: any): number =>
  error?.status ?? error?.statusCode ?? ServerError.Status.InternalServerError;

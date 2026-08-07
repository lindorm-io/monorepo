import { ServerError } from "@lindorm/errors";
import { isNumber, isString } from "@lindorm/is";
import { RedirectError } from "../../errors/index.js";
import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";
import { resolveActor } from "../../internal/utils/resolve-actor.js";
import { resolveErrorStatus } from "../../internal/utils/resolve-error-status.js";
import type {
  PylonContext,
  PylonHttpContext,
  PylonMiddleware,
} from "../../types/index.js";

type UseAuditLogOptions = {
  skip?: (ctx: PylonContext) => boolean;
  sanitise?: (body: unknown) => unknown;
};

/**
 * The per-transport slice of an audit record. Only these VALUES differ between
 * http and socket — the write that consumes them is identical — so this is a
 * resolver, not a `runHttp`/`runSocket` split.
 */
type AuditTarget = {
  endpoint: string;
  method: string;
  transport: string;
  statusCode: number;
  sourceIp: string;
  sessionId: string | null;
};

/** koa's `Response#redirect` keeps an already-redirect status, else sets 302. */
const REDIRECT_STATUSES = [300, 301, 302, 303, 305, 307, 308];
const FOUND = 302;

/**
 * The status the CLIENT will see for a request that threw.
 *
 * ⚠ `ctx.status` is useless here. `httpErrorHandlerMiddleware` is mounted in
 * pylon's global chain, ABOVE every route middleware, so it maps the error to a
 * status only after this middleware's frame has unwound — at audit time
 * `ctx.status` is still koa's untouched default (404) or whatever the route set
 * before throwing, never the answer. The error object is what the handler reads,
 * so it is what we read: same input, same `resolveErrorStatus`, one function, so
 * the two cannot drift apart.
 */
const resolveHttpStatus = (ctx: PylonHttpContext, error: unknown): number => {
  if (!error) return ctx.status;

  // The one error the handler answers with a response instead of a status: an
  // OAuth error-redirect leaves the client at a clean 302 carrying `error=…`,
  // and recording it as a 500 would say the server broke when it did not.
  // Nothing between this frame and the handler touches `ctx.status`, so koa's
  // own rule can be applied to the value the handler will read.
  if (error instanceof RedirectError) {
    return REDIRECT_STATUSES.includes(ctx.status) ? ctx.status : FOUND;
  }

  return resolveErrorStatus(error);
};

/**
 * One identifying field off a thrown error, as a string. `RedirectError` carries
 * a NUMERIC `code` for the OAuth error parameter, so the column's type is the
 * one thing that has to be forced here.
 */
const resolveErrorField = (
  error: unknown,
  field: "code" | "type",
  fallback: string,
): string | null => {
  if (!error) return null;

  const value = (error as any)[field];

  if (isString(value) && value.length) return value;
  if (isNumber(value)) return String(value);

  return fallback;
};

const resolveTarget = (ctx: PylonContext, error: unknown): AuditTarget => {
  if (isHttpContext(ctx)) {
    return {
      endpoint: ctx.request.path,
      method: ctx.request.method,
      transport: "http",
      statusCode: resolveHttpStatus(ctx, error),
      sourceIp: ctx.request.ip ?? "unknown",
      sessionId: ctx.state.metadata?.sessionId ?? null,
    };
  }
  if (isSocketContext(ctx)) {
    return {
      endpoint: ctx.event,
      method: "event",
      transport: "socket",
      // A socket event has no response status of its own, so a completed one is
      // recorded as 200. A THROWN one takes the same status the socket error
      // handler derives to pick its log level — an event that failed must not
      // be recorded as having succeeded.
      statusCode: error ? resolveErrorStatus(error) : 200,
      sourceIp: ctx.io.socket.handshake?.address ?? "unknown",
      sessionId: null,
    };
  }
  return {
    endpoint: "unknown",
    method: "unknown",
    transport: "unknown",
    statusCode: error ? resolveErrorStatus(error) : 0,
    sourceIp: "unknown",
    sessionId: null,
  };
};

export const useAuditLog = (options: UseAuditLogOptions = {}): PylonMiddleware => {
  return async function useAuditLogMiddleware(ctx: PylonContext, next) {
    // ⚠ ONE switch. `config.audit` is the whole of it — the policy and the
    // on/off used to be separate channels that could disagree, so an enabled
    // deployment with no policy threw and a disabled one with a policy silently
    // skipped. No `audit` block means pass through, never throw.
    const config = ctx.state.app.config.audit;

    if (config === false) {
      await next();
      return;
    }

    const skipFn = options.skip ?? config.skip;
    if (skipFn?.(ctx)) {
      await next();
      return;
    }

    // The only throw left, and it is the genuine one: audit is ON and there is
    // nowhere to publish the record. Read AFTER the switches, like every other
    // feature, so a skipped request never opens a session it has no use for.
    if (!ctx.bus) {
      throw new ServerError("Audit logging has no message bus to publish to", {
        code: "audit_bus_not_configured",
        type: "urn:lindorm:pylon:error:audit_bus_not_configured",
        title: "Audit Bus Not Configured",
        details:
          "PylonSettings carries an `audit` block but no `bus` source, so the audit record cannot be published. Configure `bus`, or drop the `audit` block.",
      });
    }

    const start = Date.now();

    // ⚠ The record is written whether or not the chain throws, and the original
    // error propagates untouched. A 401, 403, 429 or 500 is the request an
    // auditor most wants, and an audit log that silently drops every denial is
    // worse than none because it still looks complete.
    let error: unknown;

    try {
      await next();
    } catch (err: any) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - start;

      // ⚠ Everything below is inside a catch: a `finally` that throws REPLACES
      // the in-flight exception, so a failure to record must never be able to
      // mask what the request actually failed with.
      try {
        const sanitise = options.sanitise ?? config.sanitise;
        const body = ctx.data ? (sanitise ? sanitise(ctx.data) : ctx.data) : null;

        const actor = resolveActor(ctx);
        const { RequestAudit } = await import("../../messages/RequestAudit.js");
        const publisher = ctx.bus.publisher(RequestAudit);

        const { endpoint, method, transport, statusCode, sourceIp, sessionId } =
          resolveTarget(ctx, error);

        const message = publisher.create({
          requestId: ctx.state.metadata.id,
          correlationId: ctx.state.metadata.correlationId,
          actor,
          appName: ctx.state.app.name,
          endpoint,
          method,
          transport,
          statusCode,
          duration,
          sourceIp,
          requestBody: body as Record<string, unknown> | null,
          sessionId,
          client: ctx.state?.client ?? null,
          // ⚠ The error's CODE and TYPE, never its message or stack. A status
          // alone does not tell an auditor whether a 403 was an insufficient
          // scope or a tenant mismatch, and code/type are closed-vocabulary
          // identifiers authored in the code. A message is interpolated at the
          // throw site and routinely carries request values that `sanitise`
          // never sees; a stack is internals with no audit value. Both stay out.
          // The fallbacks match what the error handler puts on the response, so
          // a record and the client's error body name the same thing.
          errorCode: resolveErrorField(error, "code", "unknown_error"),
          errorType: resolveErrorField(error, "type", "urn:lindorm:error:unknown_error"),
        });

        void publisher.publish(message).catch((err) => {
          ctx.logger.error("Failed to publish audit log", err);
        });
      } catch (err: any) {
        ctx.logger.error("Failed to create audit log", err);
      }
    }
  };
};

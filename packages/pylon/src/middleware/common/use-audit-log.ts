import { ServerError } from "@lindorm/errors";
import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";
import { resolveActor } from "../../internal/utils/resolve-actor.js";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

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

const resolveTarget = (ctx: PylonContext): AuditTarget => {
  if (isHttpContext(ctx)) {
    return {
      endpoint: ctx.request.path,
      method: ctx.request.method,
      transport: "http",
      statusCode: ctx.status,
      sourceIp: ctx.request.ip ?? "unknown",
      sessionId: ctx.state.metadata?.sessionId ?? null,
    };
  }
  if (isSocketContext(ctx)) {
    return {
      endpoint: ctx.event,
      method: "event",
      transport: "socket",
      statusCode: 200,
      sourceIp: ctx.io.socket.handshake?.address ?? "unknown",
      sessionId: null,
    };
  }
  return {
    endpoint: "unknown",
    method: "unknown",
    transport: "unknown",
    statusCode: 0,
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

    await next();

    const duration = Date.now() - start;

    try {
      const sanitise = options.sanitise ?? config.sanitise;
      const body = ctx.data ? (sanitise ? sanitise(ctx.data) : ctx.data) : null;

      const actor = resolveActor(ctx);
      const { RequestAudit } = await import("../../messages/RequestAudit.js");
      const publisher = ctx.bus.publisher(RequestAudit);

      const { endpoint, method, transport, statusCode, sourceIp, sessionId } =
        resolveTarget(ctx);

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
      });

      void publisher.publish(message).catch((err) => {
        ctx.logger.error("Failed to publish audit log", err);
      });
    } catch (err: any) {
      ctx.logger.error("Failed to create audit log", err);
    }
  };
};

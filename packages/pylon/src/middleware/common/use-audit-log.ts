import { ServerError } from "@lindorm/errors";
import { IIrisSource } from "@lindorm/iris";
import { AUDIT_SOURCE } from "#internal/constants/symbols";
import { isHttpContext, isSocketContext } from "#internal/utils/is-context";
import { RequestAudit } from "../../messages";
import { PylonContext, PylonMiddleware } from "../../types";

type AuditConfig = {
  iris: IIrisSource;
  actor: (ctx: any) => string;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
};

type UseAuditLogOptions = {
  skip?: (ctx: PylonContext) => boolean;
  sanitise?: (body: unknown) => unknown;
};

export const useAuditLog = (options: UseAuditLogOptions = {}): PylonMiddleware => {
  return async function useAuditLogMiddleware(ctx: PylonContext, next) {
    const config = (ctx as any)[AUDIT_SOURCE] as AuditConfig | undefined;
    if (!config) {
      throw new ServerError(
        "Audit logging is not configured. Enable it in PylonOptions with audit: { enabled: true, actor: ... }",
      );
    }

    const skipFn = options.skip ?? config.skip;
    if (skipFn?.(ctx)) {
      await next();
      return;
    }

    const start = Date.now();

    await next();

    const duration = Date.now() - start;

    try {
      const sanitise = options.sanitise ?? config.sanitise;
      const body = ctx.data ? (sanitise ? sanitise(ctx.data) : ctx.data) : null;

      const actor = config.actor(ctx);
      const iris = config.iris.session({ logger: ctx.logger });
      const publisher = iris.publisher(RequestAudit);

      let endpoint: string;
      let method: string;
      let transport: string;
      let statusCode: number;
      let sourceIp: string;
      let sessionId: string | null = null;
      let userAgent: string | null = null;

      if (isHttpContext(ctx)) {
        endpoint = ctx.request.path;
        method = ctx.request.method;
        transport = "http";
        statusCode = ctx.status;
        sourceIp = ctx.request.ip ?? "unknown";
        sessionId = ctx.state.metadata?.sessionId ?? null;
        userAgent = ctx.get("user-agent") ?? null;
      } else if (isSocketContext(ctx)) {
        endpoint = ctx.event;
        method = "event";
        transport = "socket";
        statusCode = 200;
        sourceIp = ctx.socket.handshake?.address ?? "unknown";
        userAgent = null;
      } else {
        endpoint = "unknown";
        method = "unknown";
        transport = "unknown";
        statusCode = 0;
        sourceIp = "unknown";
      }

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
        userAgent,
      });

      void publisher.publish(message).catch((err) => {
        ctx.logger.error("Failed to publish audit log", err);
      });
    } catch (err: any) {
      ctx.logger.error("Failed to create audit log", err);
    }
  };
};

import { randomUUID } from "crypto";
import { DefaultLindormMiddleware } from "../../types";

export const metadataMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  const geoIp = ctx.userAgent?.geoIp ? JSON.stringify(ctx.userAgent?.geoIp) : undefined;

  ctx.metadata = {
    agent: {
      browser: ctx.get("x-agent-browser") || ctx.userAgent?.browser,
      geoIp: ctx.get("x-agent-geo-ip") || geoIp,
      os: ctx.get("x-agent-os") || ctx.userAgent?.os,
      platform: ctx.get("x-agent-platform") || ctx.userAgent?.platform,
      source: ctx.get("x-agent-source") || ctx.userAgent?.source,
      version: ctx.get("x-agent-version") || ctx.userAgent?.version,
    },
    correlationId: ctx.get("x-correlation-id") || randomUUID(),
    requestId: ctx.get("x-request-id") || randomUUID(),
  };

  await next();

  ctx.set("X-Correlation-ID", ctx.metadata.correlationId);
  ctx.set("X-Request-ID", ctx.metadata.requestId);
};

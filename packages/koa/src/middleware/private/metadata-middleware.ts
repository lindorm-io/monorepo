import { Environment, MetadataHeader } from "../../enum";
import { DefaultLindormKoaContext, DefaultLindormMiddleware } from "../../types";
import { randomUUID } from "crypto";

interface AgentContext extends DefaultLindormKoaContext {
  userAgent: Record<string, any>;
}

export const metadataMiddleware =
  (environment: Environment): DefaultLindormMiddleware<AgentContext> =>
  async (ctx, next): Promise<void> => {
    const geoIp = ctx.userAgent?.geoIp ? JSON.stringify(ctx.userAgent?.geoIp) : null;

    ctx.metadata = {
      agent: {
        browser: ctx.get(MetadataHeader.AGENT_BROWSER) || ctx.userAgent?.browser || null,
        geoIp: ctx.get(MetadataHeader.AGENT_GEO_IP) || geoIp,
        os: ctx.get(MetadataHeader.AGENT_OS) || ctx.userAgent?.os || null,
        platform: ctx.get(MetadataHeader.AGENT_PLATFORM) || ctx.userAgent?.platform || null,
        source: ctx.get(MetadataHeader.AGENT_SOURCE) || ctx.userAgent?.source || null,
        version: ctx.get(MetadataHeader.AGENT_VERSION) || ctx.userAgent?.version || null,
      },
      client: {
        id: ctx.get(MetadataHeader.CLIENT_ID) || null,
        environment:
          (ctx.get(MetadataHeader.CLIENT_ENVIRONMENT) as Environment) || Environment.UNKNOWN,
        platform: ctx.get(MetadataHeader.CLIENT_PLATFORM) || null,
        version: ctx.get(MetadataHeader.CLIENT_VERSION) || null,
      },
      device: {
        installationId: ctx.get(MetadataHeader.DEVICE_INSTALLATION_ID) || null,
        ip: ctx.get(MetadataHeader.DEVICE_IP) || null,
        linkId: ctx.get(MetadataHeader.DEVICE_LINK_ID) || null,
        name: ctx.get(MetadataHeader.DEVICE_NAME) || null,
        systemVersion: ctx.get(MetadataHeader.DEVICE_SYSTEM_VERSION) || null,
        uniqueId: ctx.get(MetadataHeader.DEVICE_UNIQUE_ID) || null,
      },
      environment,
      identifiers: {
        correlationId: ctx.get(MetadataHeader.CORRELATION_ID) || randomUUID(),
        fingerprint: ctx.get(MetadataHeader.FINGERPRINT) || null,
      },
    };

    await next();
  };

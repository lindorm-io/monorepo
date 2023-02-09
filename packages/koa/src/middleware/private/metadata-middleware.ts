import { DefaultLindormMiddleware } from "../../types";
import { Environment, Environments } from "@lindorm-io/common-types";
import { MetadataHeader } from "../../enum";
import { randomUUID } from "crypto";

export const metadataMiddleware =
  (environment: Environment): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    const geoIp = ctx.userAgent?.geoIp ? JSON.stringify(ctx.userAgent?.geoIp) : undefined;

    ctx.metadata = {
      agent: {
        browser: ctx.get(MetadataHeader.AGENT_BROWSER) || ctx.userAgent?.browser,
        geoIp: ctx.get(MetadataHeader.AGENT_GEO_IP) || geoIp,
        os: ctx.get(MetadataHeader.AGENT_OS) || ctx.userAgent?.os,
        platform: ctx.get(MetadataHeader.AGENT_PLATFORM) || ctx.userAgent?.platform,
        source: ctx.get(MetadataHeader.AGENT_SOURCE) || ctx.userAgent?.source,
        version: ctx.get(MetadataHeader.AGENT_VERSION) || ctx.userAgent?.version,
      },
      client: {
        id: ctx.get(MetadataHeader.CLIENT_ID),
        environment:
          (ctx.get(MetadataHeader.CLIENT_ENVIRONMENT) as Environment) || Environments.UNKNOWN,
        platform: ctx.get(MetadataHeader.CLIENT_PLATFORM),
        version: ctx.get(MetadataHeader.CLIENT_VERSION),
      },
      device: {
        installationId: ctx.get(MetadataHeader.DEVICE_INSTALLATION_ID),
        ip: ctx.get(MetadataHeader.DEVICE_IP),
        linkId: ctx.get(MetadataHeader.DEVICE_LINK_ID),
        name: ctx.get(MetadataHeader.DEVICE_NAME),
        systemVersion: ctx.get(MetadataHeader.DEVICE_SYSTEM_VERSION),
        uniqueId: ctx.get(MetadataHeader.DEVICE_UNIQUE_ID),
      },
      environment,
      identifiers: {
        correlationId: ctx.get(MetadataHeader.CORRELATION_ID) || randomUUID(),
        fingerprint: ctx.get(MetadataHeader.FINGERPRINT),
      },
    };

    await next();
  };

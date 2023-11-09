import { Environment } from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import { MetadataHeader } from "../../enum";
import { DefaultLindormMiddleware } from "../../types";

export const metadataMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
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
        (ctx.get(MetadataHeader.CLIENT_ENVIRONMENT) as Environment) || Environment.UNKNOWN,
      name: ctx.get(MetadataHeader.CLIENT_NAME),
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
    identifiers: {
      correlationId: ctx.get(MetadataHeader.CORRELATION_ID) || randomUUID(),
      fingerprint: ctx.get(MetadataHeader.FINGERPRINT),
      requestId: ctx.get(MetadataHeader.REQUEST_ID) || randomUUID(),
    },
  };

  await next();
};

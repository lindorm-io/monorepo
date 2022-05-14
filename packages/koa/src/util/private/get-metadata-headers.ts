import { KoaContext, KoaMetadataHeaders } from "../../types";
import { MetadataHeader } from "../../enum";

export const getMetadataHeaders = (ctx: KoaContext) => (): KoaMetadataHeaders => ({
  [MetadataHeader.AGENT_BROWSER]: ctx.metadata.agent.browser,
  [MetadataHeader.AGENT_GEO_IP]: ctx.metadata.agent.geoIp,
  [MetadataHeader.AGENT_OS]: ctx.metadata.agent.os,
  [MetadataHeader.AGENT_PLATFORM]: ctx.metadata.agent.platform,
  [MetadataHeader.AGENT_SOURCE]: ctx.metadata.agent.source,
  [MetadataHeader.AGENT_VERSION]: ctx.metadata.agent.version,

  [MetadataHeader.CLIENT_ID]: ctx.metadata.client.id,
  [MetadataHeader.CLIENT_ENVIRONMENT]: ctx.metadata.client.environment,
  [MetadataHeader.CLIENT_PLATFORM]: ctx.metadata.client.platform,
  [MetadataHeader.CLIENT_VERSION]: ctx.metadata.client.version,

  [MetadataHeader.DEVICE_INSTALLATION_ID]: ctx.metadata.device.installationId,
  [MetadataHeader.DEVICE_IP]: ctx.metadata.device.ip,
  [MetadataHeader.DEVICE_LINK_ID]: ctx.metadata.device.linkId,
  [MetadataHeader.DEVICE_NAME]: ctx.metadata.device.name,
  [MetadataHeader.DEVICE_SYSTEM_VERSION]: ctx.metadata.device.systemVersion,
  [MetadataHeader.DEVICE_UNIQUE_ID]: ctx.metadata.device.uniqueId,

  [MetadataHeader.CORRELATION_ID]: ctx.metadata.identifiers.correlationId,
  [MetadataHeader.FINGERPRINT]: ctx.metadata.identifiers.fingerprint,
});

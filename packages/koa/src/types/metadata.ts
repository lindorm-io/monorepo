import { Environment, MetadataHeader } from "../enum";

interface Agent {
  browser: string | null;
  geoIp: string | null;
  os: string | null;
  platform: string | null;
  source: string | null;
  version: string | null;
}

interface Client {
  id: string | null;
  environment: Environment;
  platform: string | null;
  version: string | null;
}

interface Device {
  installationId: string | null;
  ip: string | null;
  linkId: string | null;
  name: string | null;
  systemVersion: string | null;
  uniqueId: string | null;
}

interface Identifiers {
  correlationId: string;
  fingerprint: string | null;
}

export interface LindormKoaMetadata {
  agent: Agent;
  client: Client;
  device: Device;
  identifiers: Identifiers;
}

export interface LindormKoaMetadataHeaders {
  [MetadataHeader.AGENT_BROWSER]: string | null;
  [MetadataHeader.AGENT_GEO_IP]: string | null;
  [MetadataHeader.AGENT_OS]: string | null;
  [MetadataHeader.AGENT_PLATFORM]: string | null;
  [MetadataHeader.AGENT_SOURCE]: string | null;
  [MetadataHeader.AGENT_VERSION]: string | null;

  [MetadataHeader.CLIENT_ID]: string | null;
  [MetadataHeader.CLIENT_ENVIRONMENT]: Environment;
  [MetadataHeader.CLIENT_PLATFORM]: string | null;
  [MetadataHeader.CLIENT_VERSION]: string | null;

  [MetadataHeader.DEVICE_INSTALLATION_ID]: string | null;
  [MetadataHeader.DEVICE_IP]: string | null;
  [MetadataHeader.DEVICE_LINK_ID]: string | null;
  [MetadataHeader.DEVICE_NAME]: string | null;
  [MetadataHeader.DEVICE_SYSTEM_VERSION]: string | null;
  [MetadataHeader.DEVICE_UNIQUE_ID]: string | null;

  [MetadataHeader.CORRELATION_ID]: string | null;
  [MetadataHeader.FINGERPRINT]: string | null;
}

import { MetadataHeader } from "../enum";
import { Environment } from "@lindorm-io/common-types";

type Agent = {
  browser: string | undefined;
  geoIp: string | undefined;
  os: string | undefined;
  platform: string | undefined;
  source: string | undefined;
  version: string | undefined;
};

type Client = {
  id: string | undefined;
  environment: Environment;
  platform: string | undefined;
  version: string | undefined;
};

type Device = {
  installationId: string | undefined;
  ip: string | undefined;
  linkId: string | undefined;
  name: string | undefined;
  systemVersion: string | undefined;
  uniqueId: string | undefined;
};

type Identifiers = {
  correlationId: string;
  fingerprint: string | undefined;
};

export type LindormKoaMetadata = {
  agent: Agent;
  client: Client;
  device: Device;
  environment: Environment;
  identifiers: Identifiers;
};

export type LindormKoaMetadataHeaders = {
  [MetadataHeader.AGENT_BROWSER]: string | undefined;
  [MetadataHeader.AGENT_GEO_IP]: string | undefined;
  [MetadataHeader.AGENT_OS]: string | undefined;
  [MetadataHeader.AGENT_PLATFORM]: string | undefined;
  [MetadataHeader.AGENT_SOURCE]: string | undefined;
  [MetadataHeader.AGENT_VERSION]: string | undefined;

  [MetadataHeader.CLIENT_ID]: string | undefined;
  [MetadataHeader.CLIENT_ENVIRONMENT]: Environment;
  [MetadataHeader.CLIENT_PLATFORM]: string | undefined;
  [MetadataHeader.CLIENT_VERSION]: string | undefined;

  [MetadataHeader.DEVICE_INSTALLATION_ID]: string | undefined;
  [MetadataHeader.DEVICE_IP]: string | undefined;
  [MetadataHeader.DEVICE_LINK_ID]: string | undefined;
  [MetadataHeader.DEVICE_NAME]: string | undefined;
  [MetadataHeader.DEVICE_SYSTEM_VERSION]: string | undefined;
  [MetadataHeader.DEVICE_UNIQUE_ID]: string | undefined;

  [MetadataHeader.CORRELATION_ID]: string | undefined;
  [MetadataHeader.FINGERPRINT]: string | undefined;
};

type Agent = {
  browser: string | undefined;
  geoIp: string | undefined;
  os: string | undefined;
  platform: string | undefined;
  source: string | undefined;
  version: string | undefined;
};

export type LindormKoaMetadata = {
  agent: Agent;
  correlationId: string;
  requestId: string;
};

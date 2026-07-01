import type { UserAgentInfo } from "@lindorm/types";

export type PylonClientContext = {
  userAgent: UserAgentInfo;
  app: { name: string; version: string | null } | null;
  build: string | null;
  channel: string | null;
  device: { name: string | null; model: string | null } | null;
  platform: string | null;
  timezone: string | null;
};

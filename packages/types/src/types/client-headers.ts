export const CLIENT_HEADERS = {
  app: "x-user-agent-app",
  appVersion: "x-user-agent-app-version",
  build: "x-user-agent-build",
  channel: "x-user-agent-channel",
  deviceName: "x-user-agent-device-name",
  deviceModel: "x-user-agent-device-model",
  deviceType: "x-user-agent-device-type",
  platform: "x-user-agent-platform",
  timezone: "x-user-agent-timezone",
} as const;

export type DeviceType =
  | "desktop"
  | "mobile"
  | "tablet"
  | "bot"
  | "tv"
  | "console"
  | "unknown";

export type UserAgentInfo = {
  raw: string | null;
  browser: { name: string; version: string | null } | null;
  os: { name: string; version: string | null } | null;
  deviceType: DeviceType;
};

// Flat shape mirroring the x-user-agent-* headers 1:1 (client-declared, untrusted).
export type ClientDeclared = {
  app: string | null;
  appVersion: string | null;
  build: string | null;
  channel: string | null;
  deviceName: string | null;
  deviceModel: string | null;
  deviceType: DeviceType | null;
  platform: string | null;
  timezone: string | null;
};

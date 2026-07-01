import { CLIENT_HEADERS } from "@lindorm/types";
import type { ClientDeclared, DeviceType } from "@lindorm/types";

const MAX_LENGTH = 256;

const DEVICE_TYPES: ReadonlyArray<DeviceType> = [
  "desktop",
  "mobile",
  "tablet",
  "bot",
  "tv",
  "console",
  "unknown",
];

const normalize = (value: string | undefined): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LENGTH);
};

const normalizeDeviceType = (value: string | undefined): DeviceType | null => {
  const normalized = normalize(value);
  if (!normalized) return null;
  return (DEVICE_TYPES as ReadonlyArray<string>).includes(normalized)
    ? (normalized as DeviceType)
    : null;
};

/**
 * Reads ONLY the allowlisted x-user-agent-* headers via the supplied getter.
 * Each value is trimmed, capped at 256 chars, and empty strings become null.
 * `deviceType` is validated against the DeviceType union; unknown tokens -> null.
 */
export const parseClientHeaders = (
  get: (headerName: string) => string | undefined,
): ClientDeclared => ({
  app: normalize(get(CLIENT_HEADERS.app)),
  appVersion: normalize(get(CLIENT_HEADERS.appVersion)),
  build: normalize(get(CLIENT_HEADERS.build)),
  channel: normalize(get(CLIENT_HEADERS.channel)),
  deviceName: normalize(get(CLIENT_HEADERS.deviceName)),
  deviceModel: normalize(get(CLIENT_HEADERS.deviceModel)),
  deviceType: normalizeDeviceType(get(CLIENT_HEADERS.deviceType)),
  platform: normalize(get(CLIENT_HEADERS.platform)),
  timezone: normalize(get(CLIENT_HEADERS.timezone)),
});

/**
 * The inverse of `parseClientHeaders` (used by conduit): emits the x-user-agent-*
 * headers for every provided, non-null/non-empty field. Applies the same 256-char
 * cap for round-trip symmetry; null/undefined/empty fields are omitted entirely.
 */
export const toClientHeaders = (
  declared: Partial<ClientDeclared>,
): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (const [key, headerName] of Object.entries(CLIENT_HEADERS) as Array<
    [keyof ClientDeclared, string]
  >) {
    const value = declared[key];
    if (value == null) continue;

    const trimmed = String(value).trim();
    if (!trimmed) continue;

    headers[headerName] = trimmed.slice(0, MAX_LENGTH);
  }

  return headers;
};

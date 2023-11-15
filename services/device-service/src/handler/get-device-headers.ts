import { ServerKoaContext } from "../types";

export type DeviceHeaders = {
  installationId: string | undefined;
  linkId: string | undefined;
  name: string | undefined;
  systemVersion: string | undefined;
  uniqueId: string | undefined;
};

export const getDeviceHeaders = (ctx: ServerKoaContext): DeviceHeaders => ({
  installationId: ctx.get("x-device-installation-id"),
  linkId: ctx.get("x-device-link-id"),
  name: ctx.get("x-device-name"),
  systemVersion: ctx.get("x-device-system-version"),
  uniqueId: ctx.get("x-device-unique-id"),
});

import { DeviceLinkSalt, ServerKoaContext } from "../../types";
import { DeviceLink } from "../../entity";
import { vaultCreateSalt, vaultDeleteSalt } from "../axios";
import { PostChangeCallback } from "@lindorm-io/mongo";

export const createDeviceLinkCallback =
  (ctx: ServerKoaContext, salt: DeviceLinkSalt): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> =>
    vaultCreateSalt(ctx, deviceLink, salt);

export const destroyDeviceLinkCallback =
  (ctx: ServerKoaContext): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> =>
    vaultDeleteSalt(ctx, deviceLink);

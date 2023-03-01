import { DeviceLink } from "../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../types";
import { PostChangeCallback } from "@lindorm-io/mongo";
import { clientCredentialsMiddleware } from "../../middleware";
import { CreateEncryptedRecordRequestBody } from "@lindorm-io/common-types";

export const createDeviceLinkCallback =
  (ctx: ServerKoaContext, salt: DeviceLinkSalt): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> => {
    const {
      axios: { vaultClient },
    } = ctx;

    const body: CreateEncryptedRecordRequestBody<DeviceLinkSalt> = {
      id: deviceLink.id,
      data: salt,
    };

    await vaultClient.post("/admin/vault", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });
  };

export const destroyDeviceLinkCallback =
  (ctx: ServerKoaContext): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> => {
    const {
      axios: { vaultClient },
    } = ctx;

    await vaultClient.delete("/admin/vault/:id", {
      params: {
        id: deviceLink.id,
      },
      middleware: [clientCredentialsMiddleware()],
    });
  };

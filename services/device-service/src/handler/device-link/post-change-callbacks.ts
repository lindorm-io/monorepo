import { CreateEncryptedRecordRequestBody, GetEncryptedRecordResponseBody } from "../../common";
import { DeviceLink } from "../../entity";
import { DeviceLinkSalt, ServerKoaContext } from "../../types";
import { PostChangeCallback } from "@lindorm-io/mongo";
import { clientCredentialsMiddleware } from "../../middleware";

export const createDeviceLinkCallback =
  (ctx: ServerKoaContext, salt: DeviceLinkSalt): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> => {
    const {
      axios: { oauthClient, vaultClient },
    } = ctx;

    const body: CreateEncryptedRecordRequestBody<DeviceLinkSalt> = {
      id: deviceLink.id,
      data: salt,
    };

    await vaultClient.post("/internal/vault", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });
  };

export const destroyDeviceLinkCallback =
  (ctx: ServerKoaContext): PostChangeCallback<DeviceLink> =>
  async (deviceLink: DeviceLink): Promise<void> => {
    const {
      axios: { oauthClient, vaultClient },
    } = ctx;

    await vaultClient.delete<GetEncryptedRecordResponseBody>("/internal/vault/:id", {
      params: {
        id: deviceLink.id,
      },
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });
  };

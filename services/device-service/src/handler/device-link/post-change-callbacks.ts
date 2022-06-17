import { DeviceLinkSalt, ServerKoaContext } from "../../types";
import { DeviceLink } from "../../entity";
import { PostChangeCallback } from "@lindorm-io/mongo";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  ClientScope,
  CreateEncryptedRecordRequestBody,
  GetEncryptedRecordResponseBody,
} from "../../common";

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
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
      ],
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
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
      ],
    });
  };

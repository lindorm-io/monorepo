import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import {
  ClientScope,
  CreateEncryptedRecordRequestBody,
  GetEncryptedRecordResponseBody,
} from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomString } from "@lindorm-io/core";

export const createAccountCallback =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> => {
    const {
      axios: { oauthClient, vaultClient },
    } = ctx;

    const body: CreateEncryptedRecordRequestBody<AccountSalt> = {
      id: account.id,
      data: {
        aes: randomString(128),
        sha: randomString(128),
      },
    };

    await vaultClient.post("/internal/vault", {
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
      ],
    });
  };

export const destroyAccountCallback =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> => {
    const {
      axios: { oauthClient, vaultClient },
    } = ctx;

    await vaultClient.delete<GetEncryptedRecordResponseBody>("/internal/vault/:id", {
      params: {
        id: account.id,
      },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
      ],
    });
  };

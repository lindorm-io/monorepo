import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import { CreateEncryptedRecordRequestBody, GetEncryptedRecordResponseBody } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { getRandomString } from "@lindorm-io/core";

export const createAccountCallback =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> => {
    const {
      axios: { oauthClient, vaultClient },
    } = ctx;

    const body: CreateEncryptedRecordRequestBody<AccountSalt> = {
      id: account.id,
      data: {
        aes: getRandomString(128),
        sha: getRandomString(128),
      },
    };

    await vaultClient.post("/internal/vault", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
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
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });
  };

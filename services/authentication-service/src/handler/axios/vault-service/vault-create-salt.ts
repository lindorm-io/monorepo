import { Account } from "../../../entity";
import { AccountSalt, ServerKoaContext } from "../../../types";
import { ClientScope, CreateEncryptedRecordRequestBody } from "../../../common";
import { clientCredentialsMiddleware } from "../../../middleware";
import { getRandomString } from "@lindorm-io/core";

export const vaultCreateSalt = async (ctx: ServerKoaContext, account: Account): Promise<void> => {
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
    data: body,
    middleware: [
      clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE]),
    ],
  });
};

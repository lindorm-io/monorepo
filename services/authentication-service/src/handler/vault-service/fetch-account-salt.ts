import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import { ClientScope, GetEncryptedRecordResponseBody } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";

export const fetchAccountSalt = async (
  ctx: ServerKoaContext,
  account: Account,
): Promise<AccountSalt> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponseBody<AccountSalt>>(
    "/internal/vault/:id",
    {
      params: {
        id: account.id,
      },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.VAULT_ENCRYPTED_RECORD_READ]),
      ],
    },
  );

  return response.data.data;
};

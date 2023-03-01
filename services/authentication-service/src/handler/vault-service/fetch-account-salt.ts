import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetEncryptedRecordResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../common";

export const fetchAccountSalt = async (
  ctx: ServerKoaContext,
  account: Account,
): Promise<AccountSalt> => {
  const {
    axios: { oauthClient, vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponse<AccountSalt>>(
    "/admin/vault/:id",
    {
      params: {
        id: account.id,
      },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.VAULT_ENCRYPTED_RECORD_READ]),
      ],
    },
  );

  return response.data.data;
};

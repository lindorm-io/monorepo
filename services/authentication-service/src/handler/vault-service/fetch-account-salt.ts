import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { GetEncryptedRecordResponse } from "@lindorm-io/common-types";

export const fetchAccountSalt = async (
  ctx: ServerKoaContext,
  account: Account,
): Promise<AccountSalt> => {
  const {
    axios: { vaultClient },
  } = ctx;

  const response = await vaultClient.get<GetEncryptedRecordResponse<AccountSalt>>(
    "/admin/vault/:id",
    {
      params: {
        id: account.id,
      },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return response.data.data;
};

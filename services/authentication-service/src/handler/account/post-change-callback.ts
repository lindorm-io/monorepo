import { Account } from "../../entity";
import { AccountSalt, ServerKoaContext } from "../../types";
import { CreateEncryptedRecordRequestBody } from "@lindorm-io/common-types";
import { clientCredentialsMiddleware } from "../../middleware";
import { randomString } from "@lindorm-io/random";

export const createAccountCallback =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> => {
    const {
      axios: { vaultClient },
    } = ctx;

    const body: CreateEncryptedRecordRequestBody<AccountSalt> = {
      id: account.id,
      data: {
        aes: randomString(128),
        sha: randomString(128),
      },
    };

    await vaultClient.post("/admin/vault", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });
  };

export const destroyAccountCallback =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> => {
    const {
      axios: { vaultClient },
    } = ctx;

    await vaultClient.delete("/admin/vault/:id", {
      params: {
        id: account.id,
      },
      middleware: [clientCredentialsMiddleware()],
    });
  };

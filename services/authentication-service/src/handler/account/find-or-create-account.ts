import { ServerKoaContext } from "../../types";
import { Account } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { vaultCreateSalt } from "../axios";

export const findOrCreateAccount = async (
  ctx: ServerKoaContext,
  identityId: string,
): Promise<Account> => {
  const {
    repository: { accountRepository },
  } = ctx;

  try {
    return accountRepository.find({ id: identityId });
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }
  }

  const account = await accountRepository.create(new Account({ id: identityId }));
  await vaultCreateSalt(ctx, account);

  return account;
};

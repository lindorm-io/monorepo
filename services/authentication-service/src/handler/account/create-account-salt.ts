import { ServerKoaContext } from "../../types";
import { Account } from "../../entity";
import { vaultCreateSalt } from "../axios";

export const createAccountSalt =
  (ctx: ServerKoaContext) =>
  async (account: Account): Promise<void> =>
    vaultCreateSalt(ctx, account);

import { Account } from "../../entity";
import { Context } from "../../types";
import { filter } from "lodash";
import { oauthGetIdentitySessions } from "../axios";

export const getValidIdentitySessions = async (
  ctx: Context,
  account?: Account,
): Promise<Array<string>> => {
  if (!account) {
    return [];
  }

  try {
    const { sessions } = await oauthGetIdentitySessions(ctx, account);

    const filtered = filter(sessions, (item) => item.levelOfAssurance >= 2);

    return filtered.map((item) => item.id);
  } catch (err) {
    return [];
  }
};

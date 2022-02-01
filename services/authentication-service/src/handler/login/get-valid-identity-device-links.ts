import { Account } from "../../entity";
import { Context } from "../../types";
import { deviceLinkGetIdentityDeviceLinks } from "../axios";

export const getValidIdentityDeviceLinks = async (
  ctx: Context,
  account?: Account,
): Promise<Array<string>> => {
  if (!account) {
    return [];
  }

  try {
    const { deviceLinks } = await deviceLinkGetIdentityDeviceLinks(ctx, account);

    return deviceLinks;
  } catch (err) {
    return [];
  }
};

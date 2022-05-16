import { Account } from "../../entity";
import { ServerKoaContext } from "../../types";
import { deviceLinkGetIdentityDeviceLinks } from "../axios";

export const getValidIdentityDeviceLinks = async (
  ctx: ServerKoaContext,
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

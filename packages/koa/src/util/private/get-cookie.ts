import { DefaultLindormKoaContext } from "../../types";
import { Environment } from "../../enum";

export interface GetCookieOptions {
  signed: boolean;
}

export const getCookie = (
  ctx: DefaultLindormKoaContext,
  name: string,
  options: Partial<GetCookieOptions> = {},
): string | undefined => {
  return ctx.cookies.get(name, {
    signed:
      options.signed ||
      [Environment.PRODUCTION, Environment.STAGING].includes(ctx.server.environment),
  });
};

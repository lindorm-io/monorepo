import { includes } from "lodash";
import { DefaultLindormKoaContext } from "../../types";
import { Environment } from "../../enum";

export interface GetCookieOptions {
  signed: boolean;
}

export const getCookie =
  (ctx: DefaultLindormKoaContext) =>
  (name: string, options: Partial<GetCookieOptions> = {}): string | undefined => {
    const {
      cookies,
      server: { environment },
    } = ctx;

    const isDeployed = includes([Environment.PRODUCTION, Environment.STAGING], environment);
    const signed = options.signed || isDeployed;

    return cookies.get(name, { signed });
  };

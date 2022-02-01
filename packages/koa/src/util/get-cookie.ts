import { includes } from "lodash";
import { KoaContext } from "../types";
import { Environment } from "../enum";

export const getCookie =
  (ctx: KoaContext) =>
  (name: string): string | undefined => {
    const {
      cookies,
      server: { environment },
    } = ctx;

    const isDeployed = includes([Environment.PRODUCTION, Environment.STAGING], environment);

    return cookies.get(name, {
      signed: isDeployed,
    });
  };

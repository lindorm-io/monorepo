import { includes, isDate, isNumber } from "lodash";
import { KoaContext } from "../types";
import { Environment } from "../enum";

export const setCookie =
  (ctx: KoaContext) =>
  (name: string, value: string, expiry?: Date | number): void => {
    const {
      cookies,
      server: { environment, domain },
    } = ctx;

    const isDeployed = includes([Environment.PRODUCTION, Environment.STAGING], environment);

    cookies.set(name, value, {
      domain,
      ...(isDate(expiry) ? { expires: expiry } : {}),
      ...(isNumber(expiry) ? { maxAge: expiry } : {}),
      httpOnly: isDeployed,
      overwrite: true,
      sameSite: isDeployed ? "strict" : "none",
      secure: isDeployed,
      signed: isDeployed,
    });
  };

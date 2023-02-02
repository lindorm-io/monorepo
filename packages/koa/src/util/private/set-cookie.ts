import { DefaultLindormKoaContext } from "../../types";
import { Environment } from "../../enum";

export interface SetCookieOptions {
  domain: string;
  expires: Date;
  httpOnly: boolean;
  maxAge: number;
  overwrite: boolean;
  path: string;
  sameSite: "strict" | "lax" | "none" | boolean;
  secure: boolean;
  secureProxy: boolean;
  signed: boolean;
}

export const setCookie =
  (ctx: DefaultLindormKoaContext) =>
  (name: string, value: string, options: Partial<SetCookieOptions> = {}): void => {
    ctx.cookies.set(name, value, {
      domain: ctx.server.domain,
      ...options,
      signed:
        options.signed ||
        [Environment.PRODUCTION, Environment.STAGING].includes(ctx.server.environment),
    });
  };

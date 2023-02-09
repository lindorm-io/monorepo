import { Environments } from "@lindorm-io/common-types";
import { DefaultLindormKoaContext } from "../../types";

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
        ctx.server.environment === Environments.PRODUCTION ||
        ctx.server.environment === Environments.STAGING,
    });
  };

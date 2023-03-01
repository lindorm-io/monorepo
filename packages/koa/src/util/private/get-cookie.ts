import { DefaultLindormKoaContext } from "../../types";
import { Environment } from "@lindorm-io/common-types";

export interface GetCookieOptions {
  signed: boolean;
}

export const getCookie =
  (ctx: DefaultLindormKoaContext) =>
  (name: string, options: Partial<GetCookieOptions> = {}): string | undefined => {
    return ctx.cookies.get(name, {
      signed:
        options.signed ||
        ctx.server.environment === Environment.PRODUCTION ||
        ctx.server.environment === Environment.STAGING,
    });
  };

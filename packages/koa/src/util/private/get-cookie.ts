import { DefaultLindormKoaContext } from "../../types";
import { Environments } from "@lindorm-io/common-types";

export interface GetCookieOptions {
  signed: boolean;
}

export const getCookie =
  (ctx: DefaultLindormKoaContext) =>
  (name: string, options: Partial<GetCookieOptions> = {}): string | undefined => {
    return ctx.cookies.get(name, {
      signed:
        options.signed ||
        ctx.server.environment === Environments.PRODUCTION ||
        ctx.server.environment === Environments.STAGING,
    });
  };

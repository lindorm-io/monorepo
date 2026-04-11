import { AesKit } from "@lindorm/aes";
import { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import { PylonCommonContext, PylonCookieConfig, PylonGetCookie } from "../../../types";
import { ParsedCookie } from "./parse-cookie-header";
import { verifyCookie } from "./verify-cookie";

export type CreateGetCookieOptions = {
  ctx: Pick<PylonCommonContext, "aegis" | "amphora">;
  config: PylonCookieConfig;
  parsed: Array<ParsedCookie>;
};

export type GetCookie = <T = any>(
  name: string,
  options?: PylonGetCookie,
) => Promise<T | null>;

export const createGetCookie = ({
  ctx,
  config,
  parsed,
}: CreateGetCookieOptions): GetCookie => {
  const cache: Dict = {};

  return async function getCookie<T = any>(
    name: string,
    options: PylonGetCookie = {},
  ): Promise<T | null> {
    if (cache[name]) return cache[name];

    const cookie = parsed.find((c) => c.name === name);

    if (!cookie) return null;

    const opts = { ...config, ...options };

    if (opts.signed) {
      await verifyCookie(ctx, name, cookie.value, cookie.signature);
    }

    let value: any = cookie.value;

    if (AesKit.isAesTokenised(value)) {
      value = await ctx.aegis.aes.decrypt(value);
    } else {
      if (opts.encoding) {
        value = Buffer.from(value, opts.encoding).toString();
      }

      value = safelyParse(value);
    }

    cache[name] = value;

    return cache[name];
  };
};

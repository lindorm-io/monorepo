import { AesKit } from "@lindorm/aes";
import type { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import type {
  PylonCommonContext,
  PylonCookieConfig,
  PylonGetCookie,
} from "../../../types/index.js";
import type { ParsedCookie } from "./parse-cookie-header.js";
import { verifyCookie } from "./verify-cookie.js";

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
      await verifyCookie(ctx, name, cookie.value, cookie.signature, cookie.kid);
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

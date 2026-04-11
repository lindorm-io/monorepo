import { IAegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { IAmphora } from "@lindorm/amphora";
import { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import { PylonCookieConfig, PylonGetCookie } from "../../../types";
import { ParsedCookie } from "./parse-cookie-header";
import { verifyCookie } from "./verify-cookie";

export type CookieReaderOptions = {
  aegis: IAegis;
  amphora: IAmphora;
  config: PylonCookieConfig;
  parsed: Array<ParsedCookie>;
};

export type CookieReader = {
  get: <T = any>(name: string, options?: PylonGetCookie) => Promise<T | null>;
};

export const createCookieReader = ({
  aegis,
  amphora,
  config,
  parsed,
}: CookieReaderOptions): CookieReader => {
  const cache: Dict = {};

  return {
    get: async <T = any>(
      name: string,
      options: PylonGetCookie = {},
    ): Promise<T | null> => {
      if (cache[name]) return cache[name];

      const cookie = parsed.find((c) => c.name === name);

      if (!cookie) return null;

      const opts = { ...config, ...options };

      if (opts.signed) {
        await verifyCookie(amphora, name, cookie.value, cookie.signature);
      }

      let value: any = cookie.value;

      if (AesKit.isAesTokenised(value)) {
        value = await aegis.aes.decrypt(value);
      } else {
        if (opts.encoding) {
          value = Buffer.from(value, opts.encoding).toString();
        }

        value = safelyParse(value);
      }

      cache[name] = value;

      return cache[name];
    },
  };
};

import { Aegis } from "@lindorm/aegis";
import { B64 } from "@lindorm/b64";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { PylonHttpContext, SetCookieOptions } from "../../types";

const safelyParse = <T = any>(value: string): T => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return value as T;
  }
};

export const encodeCookieValue = async <T = any>(
  ctx: PylonHttpContext,
  value: T,
  options: SetCookieOptions = {},
): Promise<string> => {
  const string = isString(value) ? value : JSON.stringify(value);

  if (options.encrypted && !ctx.amphora.canEncrypt()) {
    throw new ServerError("Encryption requested but not possible", {
      details: "Add encryption keys to Amphora",
    });
  }

  if (!options.encrypted) {
    return B64.encode(string, "b64u");
  }

  const jwe = await ctx.aegis.jwe.encrypt(string);

  return jwe.token;
};

export const decodeCookieValue = async <T = any>(
  ctx: PylonHttpContext,
  value: string,
): Promise<T> => {
  if (Aegis.isJwe(value)) {
    const string = await ctx.aegis.jwe.decrypt(value);

    return safelyParse<T>(string.payload);
  }

  const decoded = B64.decode(value, "b64u");

  return safelyParse<T>(decoded);
};

import { AesKit, isAesTokenised } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { IKryptos, KryptosKit } from "@lindorm/kryptos";
import { CookieOptions, PylonCookieConfig } from "../../types";

const safelyParse = <T = any>(value: string): T => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return value as T;
  }
};

const tryDecryptCookie = (keys: Array<IKryptos>, value: string): string => {
  for (const kryptos of keys.filter((k) => k.operations.includes("decrypt"))) {
    try {
      return new AesKit({ kryptos }).decrypt(value);
    } catch (_) {
      // Do nothing
    }
  }

  throw new ServerError("Failed to decrypt cookie");
};

export const getCookieEncryptionKeys = (options: PylonCookieConfig): Array<IKryptos> => {
  if (!options.encryptionKeys?.length) return [];

  const result: Array<IKryptos> = [];

  let primary = true;

  for (const key of options.encryptionKeys) {
    result.push(
      KryptosKit.from.utf({
        algorithm: "dir",
        encryption: "A256GCM",
        operations: primary ? ["encrypt", "decrypt"] : ["decrypt"],
        privateKey: key,
        publicKey: "",
        type: "oct",
        use: "enc",
      }),
    );

    primary = false;
  }

  return result;
};

export const encodeCookieValue = <T = any>(
  value: T,
  keys: Array<IKryptos>,
  options: CookieOptions = {},
): string => {
  const string = isString(value) ? value : JSON.stringify(value);

  if (!keys.length || options.encrypted === false) {
    return B64.encode(string, "b64u");
  }

  const [kryptos] = keys.filter((k) => k.operations.includes("encrypt"));

  const aes = new AesKit({ kryptos });

  return B64.encode(aes.encrypt(string, "tokenised"), "b64u");
};

export const decodeCookieValue = <T = any>(value: string, keys: Array<IKryptos>): T => {
  const decoded = B64.decode(value, "b64u");

  if (!isAesTokenised(decoded)) {
    return safelyParse<T>(decoded);
  }

  if (!keys.length) {
    throw new ServerError("Missing encryption keys");
  }

  return safelyParse<T>(tryDecryptCookie(keys, decoded));
};

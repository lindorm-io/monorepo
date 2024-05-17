import { hkdfSync, randomBytes } from "crypto";

type Options = {
  derivationKey: Buffer;
  keyLength: 16 | 24 | 32;
  salt?: Buffer;
};

type Result = {
  derivedKey: Buffer;
  salt: Buffer;
};

export const _hkdf = (options: Options): Result => {
  const salt = options.salt ?? randomBytes(16);
  const info = Buffer.from("lindorm.hkdf", "utf-8");

  const derivedKey = Buffer.from(
    hkdfSync("SHA256", options.derivationKey, salt, info, options.keyLength),
  );

  return { derivedKey, salt };
};

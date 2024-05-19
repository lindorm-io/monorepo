import { hkdfSync, randomBytes } from "crypto";

type Options = {
  derivationKey: Buffer;
  hkdfSalt?: Buffer;
  keyLength: 16 | 24 | 32;
};

type Result = {
  derivedKey: Buffer;
  hkdfSalt: Buffer;
};

export const _hkdf = (options: Options): Result => {
  const hkdfSalt = options.hkdfSalt ?? randomBytes(16);
  const info = Buffer.from("lindorm.hkdf", "utf-8");

  const derivedKey = Buffer.from(
    hkdfSync("SHA256", options.derivationKey, hkdfSalt, info, options.keyLength),
  );

  return { derivedKey, hkdfSalt };
};

import { AesKeyLength } from "@lindorm/types";
import { hkdfSync, randomBytes } from "crypto";

type Options = {
  derivationKey: Buffer;
  hkdfSalt?: Buffer;
  keyLength: AesKeyLength;
};

type Result = {
  derivedKey: Buffer;
  hkdfSalt: Buffer;
};

export const hkdf = (options: Options): Result => {
  const hkdfSalt = options.hkdfSalt ?? randomBytes(16);
  const info = Buffer.from("lindorm.hkdf", "utf-8");

  const derivedKey = Buffer.from(
    hkdfSync("SHA256", options.derivationKey, hkdfSalt, info, options.keyLength),
  );

  return { derivedKey, hkdfSalt };
};

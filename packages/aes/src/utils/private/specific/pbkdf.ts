import { pbkdf2Sync, randomBytes } from "crypto";

type Options = {
  derivationKey: Buffer;
  keyLength: 16 | 24 | 32;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
};

type Result = {
  derivedKey: Buffer;
  pbkdfIterations: number;
  pbkdfSalt: Buffer;
};

// get random iterations from 90000 to 110000
const randomIterations = (): number => Math.floor(Math.random() * 20000) + 90000;

export const _pbkdf = (options: Options): Result => {
  const pbkdfSalt = options.pbkdfSalt ?? randomBytes(16);
  const pbkdfIterations = options.pbkdfIterations ?? randomIterations();

  const derivedKey = pbkdf2Sync(
    options.derivationKey,
    pbkdfSalt,
    pbkdfIterations,
    options.keyLength,
    "SHA256",
  );

  return { derivedKey, pbkdfIterations, pbkdfSalt };
};

import { AesKeyLength, ShaAlgorithm } from "@lindorm/types";
import { pbkdf2Sync, randomBytes } from "crypto";

type Options = {
  algorithm: ShaAlgorithm;
  derivationKey: Buffer;
  keyLength: AesKeyLength;
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
    options.algorithm,
  );

  return { derivedKey, pbkdfIterations, pbkdfSalt };
};

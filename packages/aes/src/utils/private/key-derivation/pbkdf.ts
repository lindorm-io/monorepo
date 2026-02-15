import { AesKeyLength, ShaAlgorithm } from "@lindorm/types";
import { pbkdf2Sync, randomBytes } from "crypto";
import { AesError } from "../../../errors";

type Options = {
  algorithm: ShaAlgorithm;
  derivationKey: Buffer;
  keyLength: AesKeyLength;
  kryptosAlgorithm: string;
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

export const pbkdf = (options: Options): Result => {
  const pbkdfSalt = options.pbkdfSalt ?? randomBytes(16);
  const pbkdfIterations = options.pbkdfIterations ?? randomIterations();

  if (pbkdfIterations < 1000) {
    throw new AesError("PBKDF2 iteration count must be at least 1000", {
      debug: { pbkdfIterations },
    });
  }

  const rfcSalt = Buffer.concat([
    Buffer.from(options.kryptosAlgorithm, "utf8"),
    Buffer.from([0x00]),
    pbkdfSalt,
  ]);

  const derivedKey = pbkdf2Sync(
    options.derivationKey,
    rfcSalt,
    pbkdfIterations,
    options.keyLength,
    options.algorithm,
  );

  return { derivedKey, pbkdfIterations, pbkdfSalt };
};

import { argon2id, hash, verify } from "argon2";
import { CryptoError } from "../errors";
import { CreateArgonSignatureOptions, VerifyArgonSignatureOptions } from "../types";

export const createArgonSignature = async ({
  data,
  hashLength = 128,
  memoryCost = 2,
  parallelism = 2,
  salt,
  saltLength = 128,
  secret,
  timeCost = 32,
}: CreateArgonSignatureOptions): Promise<string> =>
  await hash(data, {
    hashLength: hashLength,
    memoryCost: memoryCost * 1024,
    parallelism: parallelism,
    raw: false,
    ...(salt ? { salt: Buffer.from(salt) } : { saltLength }),
    ...(secret ? { secret: Buffer.from(secret) } : {}),
    timeCost: timeCost,
    type: argon2id,
  });

export const verifyArgonSignature = async ({
  data,
  secret,
  signature,
}: VerifyArgonSignatureOptions): Promise<boolean> =>
  await verify(signature, data, { ...(secret ? { secret: Buffer.from(secret) } : {}) });

export const assertArgonSignature = async ({
  data,
  secret,
  signature,
}: VerifyArgonSignatureOptions): Promise<void> => {
  if (await verifyArgonSignature({ data, secret, signature })) return;
  throw new CryptoError("Invalid Argon signature");
};

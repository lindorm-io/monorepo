import { hash, verify } from "argon2";
import { ArgonError } from "../../errors";
import { CreateArgonHashOptions, VerifyArgonHashOptions } from "../../types";

export const _createArgonHash = async ({
  data,
  hashLength = 256,
  memoryCost = 65536,
  parallelism = 8,
  secret,
  timeCost = 12,
}: CreateArgonHashOptions): Promise<string> =>
  await hash(data, {
    hashLength,
    memoryCost,
    parallelism,
    timeCost,
    ...(secret && { secret: Buffer.from(secret) }),
  });

export const _verifyArgonHash = async ({
  data,
  hash,
  secret,
}: VerifyArgonHashOptions): Promise<boolean> =>
  await verify(hash, data, secret ? { secret: Buffer.from(secret) } : undefined);

export const _assertArgonHash = async (options: VerifyArgonHashOptions): Promise<void> => {
  if (await _verifyArgonHash(options)) return;
  throw new ArgonError("Invalid Argon hash");
};

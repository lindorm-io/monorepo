import { IKryptosOct } from "@lindorm/kryptos";
import { hash, verify } from "argon2";
import { ArgonError } from "../../errors";
import { CreateArgonHashOptions, VerifyArgonHashOptions } from "../../types";

const getSecret = (kryptos?: IKryptosOct): Buffer | undefined => {
  if (!kryptos) return;

  const { privateKey } = kryptos.export("der");

  if (!privateKey) {
    throw new ArgonError("Invalid Kryptos");
  }

  return privateKey;
};

export const createArgonHash = async ({
  data,
  hashLength = 256,
  kryptos,
  memoryCost = 65536,
  parallelism = 8,
  timeCost = 12,
}: CreateArgonHashOptions): Promise<string> => {
  const secret = getSecret(kryptos);

  return await hash(data, {
    hashLength,
    memoryCost,
    parallelism,
    timeCost,
    ...(secret && { secret }),
  });
};

export const verifyArgonHash = async ({
  data,
  hash,
  kryptos,
}: VerifyArgonHashOptions): Promise<boolean> => {
  const secret = getSecret(kryptos);

  return await verify(hash, data, secret ? { secret } : undefined);
};

export const assertArgonHash = async (options: VerifyArgonHashOptions): Promise<void> => {
  if (await verifyArgonHash(options)) return;
  throw new ArgonError("Invalid Argon hash");
};

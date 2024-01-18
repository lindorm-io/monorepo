import { PublicKey, PublicKeyOptions } from "../../entity";
import { RSA_KEY_SET } from "../integration/rsa-keys.fixture";

export const createTestPublicKey = (options: Partial<PublicKeyOptions> = {}): PublicKey =>
  new PublicKey({
    key: RSA_KEY_SET.export("pem").publicKey,
    ...options,
  });

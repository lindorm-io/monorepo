import { PublicKey, PublicKeyOptions } from "../../entity";
import { TEST_PUBLIC_KEY } from "../integration/test-public-keys";

export const createTestPublicKey = (options: Partial<PublicKeyOptions> = {}): PublicKey =>
  new PublicKey({
    key: TEST_PUBLIC_KEY,
    ...options,
  });

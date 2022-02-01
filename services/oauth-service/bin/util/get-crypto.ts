import { CryptoLayered } from "@lindorm-io/crypto";
import { config } from "dotenv";

config();

export const getCrypto = (): CryptoLayered =>
  new CryptoLayered({
    aes: { secret: process.env.CRYPTO_AES },
    sha: { secret: process.env.CRYPTO_SHA },
  });

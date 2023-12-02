import { CryptoAes } from "@lindorm-io/crypto";
import { configuration } from "../server/configuration";

export const cryptoAes = new CryptoAes({ secret: configuration.secrets.aes });

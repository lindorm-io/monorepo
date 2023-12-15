import { AesCipher } from "@lindorm-io/aes";
import { configuration } from "../server/configuration";

export const aesCipher = new AesCipher({ secret: configuration.secrets.aes });

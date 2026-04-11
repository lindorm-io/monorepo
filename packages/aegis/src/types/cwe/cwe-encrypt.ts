import { CoseTarget } from "../cose-target";
import { EncryptedJwe, JweEncryptOptions } from "../jwe";

export type CweEncryptOptions = JweEncryptOptions & {
  target?: CoseTarget;
};

export type EncryptedCwe = EncryptedJwe & {
  buffer: Buffer;
};

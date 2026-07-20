import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AegisDecryptKey } from "../aegis.js";
import type { RefinedDomainTokenHeader } from "../header.js";
import type { DecodedJwe } from "./jwe-decode.js";

export type JweDecryptOptions = {
  /**
   * Per-call decryption key policy — a CHECK (plus injectable `kryptos`) on the
   * key the ciphertext's `kid` names. Consumed by `Aegis`, which resolves one.
   */
  key?: AegisDecryptKey;
};

export type DecryptedJweHeader = RefinedDomainTokenHeader<KryptosEncAlgorithm> & {
  encryption: KryptosEncryption;
};

export type DecryptedJwe = {
  decoded: DecodedJwe;
  header: DecryptedJweHeader;
  payload: string;
  token: string;
};

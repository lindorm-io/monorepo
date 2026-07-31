import type {
  AegisEncKey,
  EncryptedToken,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { encryptJwe } from "./encrypt-jwe.js";

/**
 * The raw JWE encrypt namespace (`aegis.jwe.encrypt`): resolve the recipient key
 * exactly as the COSE path does — same resolver, same floor, same
 * deployment-⊕-per-call selector merge — then encrypt the opaque payload. The kit
 * returns the bare token; this namespace wraps it in the domain `EncryptedToken`.
 */
export const rawEncryptJwe = async ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: JweEncryptOptions & { key?: AegisEncKey };
  deps: AegisDeps;
}): Promise<EncryptedToken> => {
  // `key` is the aegis-only recipient-key selector (resolves the kryptos and
  // feeds the kit's `encryption`); every other field IS the kit's
  // `JweEncryptOptions` and is forwarded structurally (`encryptJwe` spreads it
  // onto `JweKit.encrypt`), so a new encrypt option threads through with no
  // change here — and `key` never leaks onto the wire options.
  const { key, ...rest } = options;

  const kryptos = await deps.resolveEncryptKey(key);

  const token = encryptJwe({
    kryptos,
    data,
    options: rest,
    encryption: key?.encryption ?? deps.encryption,
    certBindingMode: deps.certBindingMode,
    certificateThumbprintSha1: deps.certificateThumbprintSha1,
    logger: deps.logger,
  });

  return { format: "jwe", token };
};

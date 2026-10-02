import { CweKit } from "../../classes/CweKit.js";
import type {
  AegisDecryptKey,
  CoseDecryptedEncryptedToken,
  DecryptTokenOptions,
  TokenContent,
} from "../../types/index.js";
import { decodeEncryptedCoseKid } from "../cose/cose-encryption.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWE decrypt namespace (`aegis.cwe.decrypt`) — the COSE_Encrypt0 mirror
 * of `jwe.decrypt`. Decodes the structure, resolves the recipient key by the
 * ciphertext's own `kid`, then decrypts the COSE_Encrypt0 via `CweKit` (which
 * takes the ENCODED bytes and strips the outer CWT tag itself) and returns its
 * NATIVE WIRE result (`header`/`payload`/native `Buffer` `token`).
 */
export const rawDecryptCwe = async <T extends TokenContent = Buffer>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: DecryptTokenOptions & { key?: AegisDecryptKey };
  deps: AegisDeps;
}): Promise<CoseDecryptedEncryptedToken<T>> => {
  // `key` is the aegis-only external-key injection (it resolves the kryptos);
  // every other field IS the kit's DecryptTokenOptions and is forwarded
  // structurally, so a new decrypt option threads through with no change here.
  const { key, ...decryptOptions } = options;

  const bytes = Buffer.from(token, "base64url");

  // ⚠ STRUCTURE BEFORE KEY, and this decode is kept for its refusal alone: the kid
  // read below reads a malformed header slot as no kid, so without it a malformed
  // token reaches the key lookup, and a lookup refusal answers here where the
  // domain doors, which run the same decode first
  // (`internal/wire/cose-encrypt-domain-header.ts`), answer the structural verdict
  // — the order `raw-decrypt-jwe.ts` and `internal/cose/decode-cwt.ts` take.
  // pinned: cose-sign-encrypt.test.ts
  //
  // ⚠ The kid is not read off this result: its header codec hands a text-string
  // kid back as text, which `decodeEncryptedCoseKid` reads as no kid
  // (RFC 9052 §3.1). pinned: cose-sign-encrypt.test.ts
  CweKit.decode(bytes);

  const kryptos = await deps.resolveDecryptKey(
    decodeEncryptedCoseKid(bytes),
    undefined,
    key,
  );

  return new CweKit({
    certBindingMode: deps.certBindingMode,
    defaultEncryption: deps.defaultEncryption,
    kryptos,
    logger: deps.logger,
  }).decrypt<T>(bytes, decryptOptions);
};

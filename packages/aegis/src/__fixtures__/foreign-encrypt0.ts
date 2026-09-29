import { AesKit } from "@lindorm/aes";
import type { IKryptos } from "@lindorm/kryptos";
import { Tag, encodeCbor } from "../internal/cose/cbor.js";
import {
  COSE_TAG,
  buildEncStructure,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { coseLabelToEnc } from "../internal/cose/enc-labels.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { resolveContentEncryption } from "../internal/utils/resolve-content-encryption.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";

/**
 * Which bucket the producer writes the RECIPIENT key's id into (RFC 9052 §3),
 * `"neither"` for a token that names no key at all, and `"protected-null"` for one
 * whose protected bucket HOLDS `kid` as the CBOR null while the unprotected one
 * names the key.
 *
 * Wherever a key id is written it is the SEALING key's and never a value a caller
 * chooses: a literal names a key the vault does not hold, so such a token would be
 * refused for the lookup rather than answer the placement under test.
 */
export type ForeignRecipientKid =
  | "protected"
  | "unprotected"
  | "neither"
  | "protected-null";

/**
 * Mint a COSE_Encrypt0 the way a FOREIGN producer would — from a protected
 * header this caller chooses outright.
 *
 * ⚠⚠ IT EXISTS BECAUSE `spliceCoseSlot` CANNOT REACH THIS CLASS. The protected
 * bucket IS the AEAD's AAD (RFC 9052 §5.3), so rewriting slot 0 after minting
 * makes the token unauthenticatable — a gate that runs BEFORE the AEAD can be
 * shown refusing such a token, but a gate LETTING one through cannot be told from
 * the AEAD failure that follows. Sealing the AAD and the ciphertext together is
 * the only way to state the accepting half.
 *
 * The header is written verbatim: a value aegis's own mint cannot produce — a
 * `uint` typ (RFC 9596 §2), a typ-less bucket — is exactly what a conformance
 * row needs.
 */
export const foreignEncrypt0 = (
  kryptos: IKryptos,
  protectedEntries: Map<CoseLabel, unknown>,
  plaintext: Buffer,
  recipientKid: ForeignRecipientKid = "unprotected",
): Buffer => {
  const declared = coseLabelToEnc(protectedEntries.get(coseByJose("alg")) as number);
  const sealed = resolveContentEncryption(kryptos, undefined);

  // The AEAD follows the KEY, and `CweKit.decrypt` follows label 1. A row whose
  // header disagrees with its key would reach the kit as an opaque
  // `AesError decryption_failed` — the gate verdict it was written for, lost. Said
  // here as a refusal rather than a warning, because a warning does not fire.
  if (declared !== sealed) {
    throw new Error(
      `foreignEncrypt0: header declares ${declared}, key seals with ${sealed} — pass a kryptos whose encryption is ${declared}`,
    );
  }

  const kid = Buffer.from(kryptos.id, "utf8");

  // The caller's bucket, plus the key id when it rides here — written BEFORE the
  // encoding, so a protected `kid` is inside the AAD the AEAD covers.
  const protectedMap = new Map(protectedEntries);

  if (recipientKid === "protected") protectedMap.set(coseByJose("kid"), kid);

  // ⚠ A STATED LABEL NAMING NO KEY, which is what tells a presence test from a
  // value test: `Map.get` answers `null` here, so a reader deciding on the value
  // reaches the unprotected bucket below and resolves the sealing key anyway.
  if (recipientKid === "protected-null") protectedMap.set(coseByJose("kid"), null);

  const protectedHeader = encodeProtectedHeader(protectedMap);

  const { ciphertext, iv, tag } = new AesKit({ kryptos }).encryptContent(plaintext, {
    aad: buildEncStructure(protectedHeader),
  });

  const unprotectedMap = new Map<CoseLabel, unknown>([[coseByJose("iv"), iv]]);

  if (recipientKid === "unprotected" || recipientKid === "protected-null") {
    unprotectedMap.set(coseByJose("kid"), kid);
  }

  return encodeCbor(
    new Tag(COSE_TAG.encrypt0, [
      protectedHeader,
      unprotectedMap,
      Buffer.concat([ciphertext, tag]),
    ]),
  );
};

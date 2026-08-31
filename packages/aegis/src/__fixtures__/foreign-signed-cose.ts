import type { IKryptos } from "@lindorm/kryptos";
import { SignatureKit } from "../classes/SignatureKit.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { Tag, encodeCbor } from "../internal/cose/cbor.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { signedCoseStructureTag } from "../internal/cose/signed-cose-structure-tag.js";
import {
  COSE_TAG,
  buildSecuredStructure,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";

/**
 * Mint a COSE_Sign1 / COSE_Mac0 the way a FOREIGN producer would — from a
 * protected header this caller chooses outright. The signed twin of
 * `foreignEncrypt0`; the STRUCTURE follows the key, as `CwsKit.sign` does
 * (RFC 9052 §4.2, RFC 9052 §6.2).
 *
 * ⚠⚠ IT EXISTS BECAUSE `spliceCoseSlot` CANNOT REACH THIS CLASS. The protected
 * bucket is the `Sig_structure` / `MAC_structure` input (RFC 9052 §4.4,
 * RFC 9052 §6.3), so rewriting slot 0 after minting makes the token
 * unverifiable — and `CwsKit.verify` runs its typ gate AFTER the signature
 * cycle, so a spliced token never reaches it. Re-sealing the header and the
 * payload together is the only way to state either half of the gate.
 *
 * The header is written verbatim: a value aegis's own mint cannot produce — a
 * `uint` typ (RFC 9596 §2), a typ-less bucket, a typ of another family — is
 * exactly what a row needs.
 */
export const foreignSignedCose = (
  kryptos: IKryptos,
  protectedEntries: Map<CoseLabel, unknown>,
  payload: Buffer,
): Buffer => {
  const declared = protectedEntries.get(coseByJose("alg"));
  const sealed = algToCoseLabel(kryptos.algorithm);

  // The signature follows the KEY, and `verifyCoseStructure` matches label 1
  // against it before the gate under test runs. A row whose header disagrees
  // with its key would reach the kit as an algorithm-match refusal — the gate
  // verdict it was written for, lost. Said here as a refusal rather than a
  // warning, because a warning does not fire.
  if (declared !== sealed) {
    throw new Error(
      `foreignSignedCose: header declares alg ${String(declared)}, key signs with ${sealed} — pass a kryptos whose algorithm label is ${String(declared)}`,
    );
  }

  const tag = signedCoseStructureTag(kryptos);
  const protectedHeader = encodeProtectedHeader(protectedEntries);

  const secured = new SignatureKit({ kryptos, raw: tag === COSE_TAG.sign1 }).sign(
    buildSecuredStructure(tag, protectedHeader, payload),
  );

  return encodeCbor(
    new Tag(tag, [
      protectedHeader,
      new Map<CoseLabel, unknown>([[coseByJose("kid"), Buffer.from(kryptos.id, "utf8")]]),
      payload,
      secured,
    ]),
  );
};

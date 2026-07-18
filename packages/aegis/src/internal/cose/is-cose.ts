import { Tag, decodeCbor } from "./cbor.js";
import { COSE_TAG } from "./structures.js";

// A CWT may wrap its COSE object in the CWT tag (61); unwrap to the inner
// COSE_Sign1 / COSE_Mac0 / COSE_Encrypt0 either way.
const innerCose = (value: unknown): Tag | undefined =>
  value instanceof Tag && value.tag === COSE_TAG.cwt
    ? (value.contents as Tag | undefined)
    : (value as Tag | undefined);

/**
 * Is this byte string a COSE token (a CWT, or a bare COSE object)? The cheap
 * structural discriminator between the COSE and JOSE wires — decode the CBOR and
 * look for a COSE tag. Never throws: malformed / non-CBOR input is simply "not COSE".
 */
export const isCose = (bytes: Buffer): boolean => {
  try {
    const tag = innerCose(decodeCbor(bytes))?.tag;

    return tag === COSE_TAG.sign1 || tag === COSE_TAG.mac0 || tag === COSE_TAG.encrypt0;
  } catch {
    return false;
  }
};

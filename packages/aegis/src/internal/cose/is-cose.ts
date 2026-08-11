import { decodeCbor } from "./cbor.js";
import { COSE_TAG } from "./structures.js";
import { coseStructure } from "./unwrap-cose.js";

/**
 * Is this byte string a COSE token (a CWT, or a bare COSE object)? The cheap
 * structural discriminator between the COSE and JOSE wires — decode the CBOR and
 * look for a COSE tag. Never throws: malformed / non-CBOR input is simply "not COSE".
 */
export const isCose = (bytes: Buffer): boolean => {
  try {
    const tag = coseStructure(decodeCbor(bytes))?.tag;

    return tag === COSE_TAG.sign1 || tag === COSE_TAG.mac0 || tag === COSE_TAG.encrypt0;
  } catch {
    return false;
  }
};

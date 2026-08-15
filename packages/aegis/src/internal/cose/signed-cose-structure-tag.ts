import type { IKryptos } from "@lindorm/kryptos";
import { CwsError } from "../../errors/index.js";
import { type CoseStructureTag, coseStructureTag } from "./cose-structure-tag.js";

/**
 * Which COSE integrity structure a resolved key implies (RFC 9052 §4.4 / §6.3) —
 * the ONE gate every signed COSE verb asks, and the only difference between a
 * COSE_Sign1 and a COSE_Mac0 on the wire.
 *
 * ⚠ ONE call, not four. `signCwt`, `verifyCwt` and both of `CwsKit`'s verbs used
 * to ask it separately — the kit through a private method whose body was
 * character-for-character the claims core's, down to the details string — so
 * sign and verify could have come to disagree about which structure a key
 * produces. They cannot now: the tag is one function, and where a verb needs it
 * twice it is computed once and passed.
 *
 * The kits gate their key's `algClass` in their constructors, so this is settled
 * by the time any verb runs; asking it here is what keeps the WRITE and the READ
 * of one token answering the same way.
 */
export const signedCoseStructureTag = (kryptos: IKryptos): CoseStructureTag =>
  coseStructureTag({
    algClass: kryptos.algClass,
    error: CwsError,
    details:
      "The resolved key's algClass is neither asymmetric nor symmetric, so no COSE integrity structure applies.",
  });

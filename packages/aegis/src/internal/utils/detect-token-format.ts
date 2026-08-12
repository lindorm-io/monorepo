import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { TokenFormatTag } from "../../types/index.js";
import { decodeCbor } from "../cose/cbor.js";
import { isCose } from "../cose/is-cose.js";
import { COSE_TAG } from "../cose/structures.js";
import { coseStructure } from "../cose/unwrap-cose.js";
import {
  isCwe as isCweBytes,
  isCwm as isCwmBytes,
  isCws as isCwsBytes,
  isCwt as isCwtBytes,
} from "../cose/is-cose-format.js";

/**
 * The ONE format detector. Every domain verb — verify, parse, decrypt — asks the
 * same question of a token it was handed, and each used to answer it with its own
 * ladder of `isJwt` / `isJws` / `isJwe` / `isCose` checks in its own order. A
 * ladder is a decision, and three copies of a decision are three chances to
 * disagree about what a token IS.
 *
 * `undefined` means "not a token aegis recognises"; the caller owns the refusal,
 * because each verb refuses for its own reason.
 *
 * A JOSE token is dot-delimited and a COSE token never is, so the cheap
 * discriminant runs first and a dotted token never reaches the CBOR decoder.
 */
export const detectTokenFormat = (token: string): TokenFormatTag | undefined => {
  if (token.includes(".")) {
    if (JwtKit.isJwt(token)) return "jwt";
    if (JweKit.isJwe(token)) return "jwe";
    if (JwsKit.isJws(token)) return "jws";
    return undefined;
  }

  const bytes = Buffer.from(token, "base64url");

  if (!isCose(bytes)) return undefined;

  // These four are mutually exclusive BY CONSTRUCTION, not by ordering: each
  // requires its own `typ` media type (`+cwt` / `+cws` / `+cwe`) or, for a CWE,
  // its own structure tag, and a token carries one `typ`. The order is
  // presentational — do not read it as a constraint and preserve it as one.
  if (isCwsBytes(bytes)) return "cws";
  if (isCwtBytes(bytes)) return "cwt";
  if (isCwmBytes(bytes)) return "cwm";
  if (isCweBytes(bytes)) return "cwe";

  // ⚠ A COSE token may legitimately carry NO typ at all — RFC 9596 leaves label
  // 16 optional, where aegis POLICY requires one on JOSE — so the four
  // typ-driven guards above all decline a conformant foreign CWT. The STRUCTURE
  // is what remains, and it is exactly what the read path uses to report `cwt` vs
  // `cwm` once the token is decoded: COSE_Sign1 is a claims-bearing CWT,
  // COSE_Mac0 a CWM, COSE_Encrypt0 a CWE.
  switch (coseStructure(decodeCbor(bytes))?.tag) {
    case COSE_TAG.sign1:
      return "cwt";
    case COSE_TAG.mac0:
      return "cwm";
    case COSE_TAG.encrypt0:
      return "cwe";
    default:
      return undefined;
  }
};

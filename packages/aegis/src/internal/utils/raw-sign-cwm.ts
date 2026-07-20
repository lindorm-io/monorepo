import { getUnixTime } from "@lindorm/date";
import { isDate, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { SignCwtContent, SignCwtOptions, SignedCwt } from "../../types/index.js";
import { coseTypFromTokenType } from "../cose/cose-typ.js";
import { signCose } from "../cose/sign-cose.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleCwtClaims } from "./assemble-cwt-claims.js";
import { withSensitiveDomain } from "./jwt-payload.js";

/**
 * The raw CWM sign namespace (`aegis.cwm.sign`) — the COSE_Mac0 (symmetric) twin
 * of `aegis.cwt.sign`. Identical policy-free assembly; only the integrity
 * structure differs (a MAC, not a signature). A CWM shares the CWT media type
 * (`application/cwt` / `+cwt`) — the STRUCTURE (Mac0 vs Sign1) is what tells `cwm`
 * apart from `cwt` (D6). A symmetric key is required; an asymmetric one throws
 * via the kit gate (that is `aegis.cwt.sign`).
 */
export const rawSignCwm = async <C extends Dict = Dict>({
  content,
  options = {},
  deps,
}: {
  content: SignCwtContent<C>;
  options?: SignCwtOptions;
  deps: AegisDeps;
}): Promise<SignedCwt> => {
  const kryptos = await deps.resolveSignKey({ key: options.key });

  const common = withSensitiveDomain(
    assembleCwtClaims({ issuer: deps.issuer }, content, options),
    content,
  );

  const token = signCose({
    kryptos,
    logger: deps.logger,
    common,
    typ: options.typ ?? coseTypFromTokenType(content.tokenType),
    proprietary: options.proprietary,
    omit: options.omit,
    format: "cwm",
  });

  const expiresAt = isDate(common.expiresAt) ? common.expiresAt : undefined;
  const expiresOn = expiresAt ? getUnixTime(expiresAt) : undefined;

  return {
    token: token.toString("base64url"),
    expiresAt,
    expiresIn: expiresOn ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    objectId: options.objectId,
    tokenId: isString(common.tokenId) ? common.tokenId : undefined,
  };
};

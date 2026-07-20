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
 * The raw CWT sign namespace (`aegis.cwt.sign`) — the generic-CWT mirror of the
 * generic `jwt.sign`. Policy-free: maps the standard-claim content to the
 * domain-keyed claims (via the shared claim registry) and secures them with
 * `signCose` — the SAME primitive `mintCoseToken` uses, minus the profile floor
 * and auto-injection.
 */
export const rawSignCwt = async <C extends Dict = Dict>({
  content,
  options = {},
  deps,
}: {
  content: SignCwtContent<C>;
  options?: SignCwtOptions;
  deps: AegisDeps;
}): Promise<SignedCwt> => {
  const kryptos = await deps.resolveSignKey({ key: options.key });

  // Merge the FLAT sensitive claims into the domain layer so `domainToCose`
  // emits each as its individual CWT label — symmetric with `aegis.jwt.sign`.
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

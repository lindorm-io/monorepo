import { isBoolean, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import type { AegisIntrospection } from "../../types/index.js";
import { extractDomainClaims } from "./extract-claims.js";

// Locally-defined input shape — permissive structural type so a consumer's
// `OpenIdIntrospectResponse` (or a plain JSON body from a fetch call) still
// passes through without an explicit cast. Aegis owns the claim-parsing
// surface; it does not import wire types from @lindorm/types.
export type IntrospectClaimsInput = Dict & {
  active?: unknown;
};

export const parseIntrospection = (data: IntrospectClaimsInput): AegisIntrospection => {
  if (!isBoolean(data.active)) {
    throw new AegisError("Missing active claim");
  }

  if (!data.active) {
    return { active: false };
  }

  const { claims } = extractDomainClaims(data);

  return removeUndefined({
    ...claims,
    active: true as const,
    tokenType: isString(data.tokenType)
      ? data.tokenType
      : isString((data as Dict).token_type)
        ? ((data as Dict).token_type as string)
        : undefined,
    username: isString(data.username) ? data.username : undefined,
  });
};

import { isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { ChallengeParams, ChallengeScheme } from "../../../types/index.js";

// RFC 9110 §11.1 — the scheme is case-insensitive on the wire, but the RFCs (and
// clients matching naively) spell it this way.
const SCHEME: Record<ChallengeScheme, string> = {
  basic: "Basic",
  bearer: "Bearer",
  dpop: "DPoP",
};

// Auth-params are unordered (RFC 9110 §11.2); pin an order so output is stable.
// Tuples are [context key, wire key]. `nonce` is deliberately absent — RFC 9449 §8
// carries it in the DPoP-Nonce header, not as an auth-param.
const PARAMS: Array<[string, string]> = [
  ["realm", "realm"],
  ["charset", "charset"],
  ["error", "error"],
  ["errorDescription", "error_description"],
  ["scope", "scope"],
  ["algs", "algs"],
];

// RFC 9110 §5.6.4 — quoted-string: `\` and `"` are backslash-escaped.
const quote = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export const serializeChallenge = <S extends ChallengeScheme>(
  scheme: S,
  params?: ChallengeParams[S],
): string => {
  const dict = (params ?? {}) as Dict;

  const authParams = PARAMS.flatMap(([key, wire]) => {
    const value = dict[key];

    // RFC 9449 §7.1 — `algs` is a space-delimited list inside the quotes.
    const serialized = isArray(value) ? value.filter(isString).join(" ") : value;

    if (!isString(serialized) || !serialized.length) return [];

    return [`${wire}=${quote(serialized)}`];
  });

  if (!authParams.length) return SCHEME[scheme];

  return `${SCHEME[scheme]} ${authParams.join(", ")}`;
};

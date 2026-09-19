import { isArray } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { calculateJwkThumbprint, CompactSign, importJWK, type JWK } from "jose";
import { createHash } from "node:crypto";

/**
 * A DPoP proof written by SOMETHING THAT IS NOT AEGIS — the `jose` library — at
 * run time, over the access token it is presented with: `ath` commits to that
 * token (RFC 9449 §4.2), so no proof can exist before the token does. The
 * presenter's public key rides in the header as `jwk`; the private half never
 * leaves this module. A presenter is by definition not the verifier, so a proof
 * aegis both wrote and read would show only that the two agree.
 *
 * ⛔ Imports nothing from `src/internal/` or `src/classes/`.
 */

/** What the presenter signs — RFC 9449 §4.2 `jti`, `htm` and `htu`. */
export type DpopProofStatement = {
  tokenId: string;
  httpMethod: string;
  httpUri: string;
};

/** The public half of a key as the JWK its thumbprint is computed over (RFC 7638 §3.2). */
export const publicJwkOf = (kryptos: IKryptos): JWK => {
  const { kty, crv, x, y, n, e } = kryptos.export("jwk") as Dict;

  return omitUndefined({ kty, crv, x, y, n, e }) as JWK;
};

/**
 * The RFC 7638 SHA-256 thumbprint of the key's public JWK, base64url — the `jkt`
 * a token bound to this key carries (RFC 9449 §6.1). Derived from the key
 * material by a library that is not aegis, never spelled out as a literal.
 */
export const jwkThumbprintOf = (kryptos: IKryptos): Promise<string> =>
  calculateJwkThumbprint(publicJwkOf(kryptos), "sha256");

/** `ath`: the base64url SHA-256 of the ASCII access token (RFC 9449 §4.2). */
export const accessTokenHashOf = (token: string): string =>
  createHash("sha256").update(token, "ascii").digest("base64url");

/**
 * Sign a proof with `kryptos` over `accessToken`, writing `header` beside the
 * three parameters RFC 9449 §4.2 requires — last, so a stated parameter can
 * restate a derived one. A `crit` the header carries is declared to the library
 * as implemented, because a presenter's own extension is one it understands.
 */
export const signDpopProofAsPresenter = async (
  kryptos: IKryptos,
  statement: DpopProofStatement,
  accessToken: string,
  header: Dict = {},
): Promise<string> => {
  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  const payload = Buffer.from(
    JSON.stringify({
      jti: statement.tokenId,
      htm: statement.httpMethod,
      htu: statement.httpUri,
      iat: Math.floor(Date.now() / 1000),
      ath: accessTokenHashOf(accessToken),
    }),
    "utf8",
  );

  const protectedHeader: Dict & { alg: string } = {
    alg: kryptos.algorithm,
    typ: "dpop+jwt",
    jwk: publicJwkOf(kryptos),
    ...header,
  };

  const crit = isArray(protectedHeader.crit)
    ? Object.fromEntries(protectedHeader.crit.map((member) => [String(member), true]))
    : undefined;

  return new CompactSign(payload)
    .setProtectedHeader(protectedHeader as never)
    .sign(key, crit === undefined ? undefined : { crit });
};

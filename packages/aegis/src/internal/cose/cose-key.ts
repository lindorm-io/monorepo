import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";
import { B64U } from "../constants/format.js";
import { CoseError } from "../../errors/index.js";

// COSE_Key parameter labels (RFC 9052 §7).
const KEY = { kty: 1, kid: 2, alg: 3, crv: -1, x: -2, y: -3 } as const;

// kty labels (JWK kty -> COSE). JWK "EC" is COSE "EC2" (2).
export const KTY_TO_COSE: Readonly<Record<string, number>> = {
  OKP: 1,
  EC: 2,
  RSA: 3,
  oct: 4,
};
const COSE_TO_KTY: Readonly<Record<number, string>> = {
  1: "OKP",
  2: "EC",
  3: "RSA",
  4: "oct",
};

// Elliptic curve labels (RFC 9053 §7.1).
export const CRV_TO_COSE: Readonly<Record<string, number>> = {
  "P-256": 1,
  "P-384": 2,
  "P-521": 3,
  X25519: 4,
  X448: 5,
  Ed25519: 6,
  Ed448: 7,
};
const COSE_TO_CRV: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(CRV_TO_COSE).map(([crv, label]) => [label, crv]),
);

const unsupported = (detail: string): never => {
  throw new CoseError("Unsupported COSE_Key", {
    code: "cose_key_unsupported",
    title: "Unsupported COSE Key",
    details: detail,
  });
};

/**
 * Convert a public JWK to a COSE_Key map (RFC 9052 §7). EC2 and OKP public keys
 * are supported (the common proof-of-possession key types); RSA/oct cnf keys
 * are not yet handled.
 */
export const jwkToCoseKey = (jwk: Dict): Map<number, unknown> => {
  const ktyLabel = KTY_TO_COSE[jwk.kty as string];
  if (ktyLabel === undefined) unsupported(`Unknown JWK kty "${jwk.kty}".`);

  const key = new Map<number, unknown>();
  key.set(KEY.kty, ktyLabel);
  if (typeof jwk.kid === "string") key.set(KEY.kid, Buffer.from(jwk.kid, "utf8"));

  if (jwk.kty === "EC" || jwk.kty === "OKP") {
    const crvLabel = CRV_TO_COSE[jwk.crv as string];
    if (crvLabel === undefined) unsupported(`Unknown curve "${jwk.crv}".`);
    key.set(KEY.crv, crvLabel);
    key.set(KEY.x, B64.toBuffer(jwk.x as string, B64U));
    if (jwk.kty === "EC") key.set(KEY.y, B64.toBuffer(jwk.y as string, B64U));
    return key;
  }

  return unsupported("Only EC2 and OKP COSE_Key conversion is supported.");
};

/** Convert a COSE_Key map back to a public JWK. */
export const coseKeyToJwk = (key: Map<number, unknown>): Dict => {
  const kty = COSE_TO_KTY[key.get(KEY.kty) as number];
  if (kty === undefined) unsupported("Unknown COSE_Key kty.");

  const jwk: Dict = { kty };
  const kid = key.get(KEY.kid);
  if (kid instanceof Uint8Array) jwk.kid = Buffer.from(kid).toString("utf8");

  if (kty === "EC" || kty === "OKP") {
    jwk.crv = COSE_TO_CRV[key.get(KEY.crv) as number];
    jwk.x = B64.encode(Buffer.from(key.get(KEY.x) as Uint8Array), B64U);
    if (kty === "EC") jwk.y = B64.encode(Buffer.from(key.get(KEY.y) as Uint8Array), B64U);
    return jwk;
  }

  return unsupported("Only EC2 and OKP COSE_Key conversion is supported.");
};

/**
 * Encode the JOSE `cnf` to a COSE cnf map (RFC 8747): an embedded public key
 * (`jwk`) -> COSE_Key (member 1), a key id (`kid`) -> kid (member 3). Since Phase
 * 5 the translator (`domainToCose`) already mapped the domain confirmation to its
 * JOSE `cnf` member names, so this accepts `{ jwk, kid, jkt, x5t#S256, jku }` (the
 * JOSE cnf), NOT the domain `{ key, keyId, thumbprint }`. The thumbprint-only
 * forms (`jkt`/`x5t#S256`/`jku`) have no COSE cnf representation (jkt ≠ ckt) and
 * are rejected.
 */
export const encodeCnf = (cnf: Dict): Map<number, unknown> => {
  const out = new Map<number, unknown>();

  if (cnf.jwk && typeof cnf.jwk === "object") {
    out.set(1, jwkToCoseKey(cnf.jwk as Dict));
  }
  if (typeof cnf.kid === "string") {
    out.set(3, Buffer.from(cnf.kid, "utf8"));
  }

  if (out.size === 0) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      title: "COSE Confirmation Unsupported",
      details:
        "Only an embedded key (jwk -> COSE_Key) or kid (-> kid) can go in a COSE cnf; jkt/x5t#S256/jku have no COSE form (jkt ≠ ckt).",
    });
  }

  return out;
};

/**
 * Decode a COSE cnf map back to the JOSE `cnf` shape (`{ jwk, kid }`) — the read
 * twin of {@link encodeCnf}. `coseToDomain` then maps it to the domain
 * confirmation, exactly as the JOSE path's `joseToDomain` does.
 */
export const decodeCnf = (cnf: Map<number, unknown>): Dict => {
  const out: Dict = {};

  const coseKey = cnf.get(1);
  if (coseKey instanceof Map) out.jwk = coseKeyToJwk(coseKey);

  const kid = cnf.get(3);
  if (kid instanceof Uint8Array) out.kid = Buffer.from(kid).toString("utf8");

  return out;
};

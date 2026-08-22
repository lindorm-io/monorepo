import { B64 } from "@lindorm/b64";
import { ShaKit } from "@lindorm/sha";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import { B64U } from "../constants/format.js";
import { encodeCbor } from "./cbor.js";
import { CRV_TO_COSE, KTY_TO_COSE } from "./cose-key.js";
import { ownEntry } from "./own-entry.js";

/**
 * COSE Key Thumbprint (RFC 9679) — the COSE analogue of the RFC 7638 JWK
 * Thumbprint. A digest over the deterministically-encoded COSE_Key holding only
 * the key type's required parameters (RFC 9679 §4), so it identifies the KEY,
 * independent of `kid`, `alg` and any other optional member. SHA-256 by default.
 */

export type CoseThumbprintHash = "sha-256" | "sha-384" | "sha-512";

// Named Information Hash Algorithm name -> ShaKit base64url digest.
const SHA: Readonly<Record<CoseThumbprintHash, (data: Buffer) => string>> = {
  "sha-256": (data) => ShaKit.S256(data),
  "sha-384": (data) => ShaKit.S384(data),
  "sha-512": (data) => ShaKit.S512(data),
};

const bstr = (value: unknown): Buffer => B64.toBuffer(String(value), B64U);

const curveLabel = (jwk: Dict): number => {
  // ⚠ `ownEntry`, never `CRV_TO_COSE[jwk.crv]`: the JWK is the caller's, and a
  // prototype member name resolves to a function this CBOR-encodes as a curve
  // label. See own-entry.ts.
  const label = ownEntry(CRV_TO_COSE, jwk.crv);
  if (label === undefined) {
    throw new CoseError(`Unsupported curve "${jwk.crv}" for COSE Key Thumbprint`, {
      code: "cose_key_unsupported",
      data: { crv: jwk.crv },
      title: "Unsupported COSE Key",
      details:
        "The JWK curve has no COSE label, so a COSE Key Thumbprint cannot be computed.",
    });
  }
  return label;
};

/**
 * Build the required-only COSE_Key map for the thumbprint. RFC 9679 §4.
 * Deterministic CBOR sorts the labels, so insertion order does not matter.
 */
const requiredCoseKey = (jwk: Dict): Map<number, unknown> => {
  const map = new Map<number, unknown>();

  switch (jwk.kty) {
    case "EC":
      map.set(1, KTY_TO_COSE.EC); // EC2
      map.set(-1, curveLabel(jwk));
      map.set(-2, bstr(jwk.x));
      map.set(-3, bstr(jwk.y));
      return map;
    case "OKP":
      map.set(1, KTY_TO_COSE.OKP);
      map.set(-1, curveLabel(jwk));
      map.set(-2, bstr(jwk.x));
      return map;
    case "RSA":
      map.set(1, KTY_TO_COSE.RSA);
      map.set(-1, bstr(jwk.n));
      map.set(-2, bstr(jwk.e));
      return map;
    case "oct":
      map.set(1, KTY_TO_COSE.oct);
      map.set(-1, bstr(jwk.k));
      return map;
    default:
      throw new CoseError(
        `Cannot compute COSE Key Thumbprint: unsupported kty "${String(jwk.kty)}"`,
        {
          code: "cose_key_unsupported",
          data: { kty: jwk.kty },
          title: "Unsupported COSE Key",
          details:
            "aegis computes a COSE Key Thumbprint for kty EC, OKP, RSA and oct only; this kty is not one of them. RFC 9679 §4.",
        },
      );
  }
};

const thumbprintCbor = (jwk: Dict): Buffer =>
  Buffer.from(encodeCbor(requiredCoseKey(jwk)));

/** The raw COSE Key Thumbprint bytes — RFC 9679 §3. */
export const computeCoseKeyThumbprint = (
  jwk: Dict,
  hash: CoseThumbprintHash = "sha-256",
): Buffer => B64.toBuffer(SHA[hash](thumbprintCbor(jwk)), B64U);

/**
 * The COSE Key Thumbprint URI — RFC 9679 §5.7. base64url without padding, the
 * form ShaKit already emits.
 */
export const computeCoseKeyThumbprintUri = (
  jwk: Dict,
  hash: CoseThumbprintHash = "sha-256",
): string => `urn:ietf:params:oauth:ckt:${hash}:${SHA[hash](thumbprintCbor(jwk))}`;

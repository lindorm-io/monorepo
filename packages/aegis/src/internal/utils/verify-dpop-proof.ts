import { KryptosKit } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import { JwtError } from "../../errors/index.js";
import type { ParsedDpopProof } from "../../types/jwt/jwt-dpop.js";
import { computeJwkThumbprint } from "./compute-jwk-thumbprint.js";
import { decodeJoseHeader } from "./jose-header.js";
import { verifyJoseSignature } from "./jose-signature.js";
import { decodeJwtPayload } from "./jwt-payload.js";

type Options = {
  proof: string;
  accessToken: string;
  expectedThumbprint: string;
  dpopMaxSkew: number;
};

type DpopProofPayload = {
  jti?: unknown;
  htm?: unknown;
  htu?: unknown;
  iat?: unknown;
  ath?: unknown;
  nonce?: unknown;
};

const assertString = (value: unknown, claim: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new JwtError(`Invalid DPoP proof: "${claim}" claim is required`);
  }
  return value;
};

export const verifyDpopProof = (options: Options): ParsedDpopProof => {
  const { proof, accessToken, expectedThumbprint, dpopMaxSkew } = options;

  const parts = proof.split(".");
  if (parts.length !== 3) {
    throw new JwtError("Invalid DPoP proof: not a compact JWS");
  }
  const [headerB64, payloadB64] = parts;

  const header = decodeJoseHeader(headerB64);

  if (header.typ !== "dpop+jwt") {
    throw new JwtError("Invalid DPoP proof: header typ must be dpop+jwt", {
      data: { typ: header.typ },
    });
  }

  if (!header.jwk) {
    throw new JwtError("Invalid DPoP proof: header jwk is required");
  }

  const rawJwk = header.jwk as Record<string, unknown>;

  // RFC 7638 thumbprint from the raw JWK — uses only canonical key-material
  // fields (kty/crv/x/y for EC, kty/e/n for RSA, kty/crv/x for OKP).
  const thumbprint = computeJwkThumbprint(rawJwk);

  if (thumbprint !== expectedThumbprint) {
    throw new JwtError("Invalid DPoP proof: thumbprint does not match cnf.jkt", {
      data: { expected: expectedThumbprint, actual: thumbprint },
    });
  }

  // Signature verification requires a Kryptos instance because the
  // SignatureKit dispatch chain (EcKit/RsaKit/OkpKit) is coupled to
  // IKryptos. The DPoP proof JWK carries only key material; we supply
  // `alg` from the JOSE header (authoritative per RFC 9449) and
  // `use: "sig"` (DPoP proofs are always signatures).
  const proofKryptos = KryptosKit.from.jwk({
    ...rawJwk,
    alg: header.alg,
    use: "sig",
  } as Parameters<typeof KryptosKit.from.jwk>[0]);

  if (!verifyJoseSignature(proofKryptos, proof)) {
    throw new JwtError("Invalid DPoP proof: signature verification failed");
  }

  const payload = decodeJwtPayload<DpopProofPayload>(payloadB64);

  const tokenId = assertString(payload.jti, "jti");
  const httpMethod = assertString(payload.htm, "htm");
  const httpUri = assertString(payload.htu, "htu");

  if (typeof payload.iat !== "number") {
    throw new JwtError("Invalid DPoP proof: iat claim is required");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.iat) > dpopMaxSkew) {
    throw new JwtError("Invalid DPoP proof: iat is outside the allowed skew window", {
      data: { iat: payload.iat, now, dpopMaxSkew },
    });
  }

  const expectedAth = ShaKit.S256(accessToken);
  if (payload.ath !== expectedAth) {
    throw new JwtError("Invalid DPoP proof: ath does not match access token hash");
  }

  return {
    thumbprint,
    tokenId,
    httpMethod,
    httpUri,
    issuedAt: new Date(payload.iat * 1000),
    accessTokenHash: expectedAth,
    nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
  };
};

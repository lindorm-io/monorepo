import { KryptosKit } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import type { Dict } from "@lindorm/types";
import { webcrypto } from "crypto";

type Jwk = Record<string, unknown>;

const base64url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const publicPart = (jwk: Jwk): Jwk => {
  const { kty, crv, x, y } = jwk;

  return { kty, crv, x, y };
};

export type DpopTestClient = {
  /** RFC 7638 thumbprint of the client key — the `cnf.jkt` a token is bound to. */
  jkt: string;
  /** Sign a real RFC 9449 proof over the given request + access token. */
  sign: (options: {
    method: string;
    uri: string;
    accessToken: string;
    /** Proof `iat`, in seconds. Defaults to now. */
    issuedAt?: number;
    /**
     * Extra protected header parameters, WIRE-named — the proof is assembled here
     * rather than through a domain mint door, so `crit: ["oid"]` is how the
     * declaration `["objectId"]` is spelled on this wire.
     */
    header?: Dict;
  }) => Promise<string>;
};

/**
 * A real DPoP client: a genuine ES256 key pair plus a real signer for its proofs.
 * `Aegis.verifyDpopProof` checks the signature against the key embedded in the
 * proof header, so a stubbed proof would prove nothing.
 */
export const createDpopTestClient = async (): Promise<DpopTestClient> => {
  const pair = (await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const jwk = publicPart(
    (await webcrypto.subtle.exportKey("jwk", pair.publicKey)) as unknown as Jwk,
  );

  const jkt = KryptosKit.from.jwk({ ...jwk, alg: "ES256", use: "sig" } as any).thumbprint;

  const sign: DpopTestClient["sign"] = async (options) => {
    const header = base64url(
      JSON.stringify({ alg: "ES256", typ: "dpop+jwt", jwk, ...options.header }),
    );
    const payload = base64url(
      JSON.stringify({
        jti: webcrypto.randomUUID(),
        htm: options.method,
        htu: options.uri,
        iat: options.issuedAt ?? Math.floor(Date.now() / 1000),
        ath: ShaKit.S256(options.accessToken),
      }),
    );

    const signature = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );

    return [header, payload, Buffer.from(signature).toString("base64url")].join(".");
  };

  return { jkt, sign };
};

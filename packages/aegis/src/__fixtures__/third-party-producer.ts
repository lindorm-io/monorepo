import {
  Algorithms,
  COSEKey,
  Headers,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders,
} from "@auth0/cose";
import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { encode, Tag } from "cbor2";
import { registerEncoder, writeUint8Array } from "cbor2/encoder";
import { CompactSign, importJWK } from "jose";
import type { Wire } from "./raw-bucket.js";

/**
 * A claims token written by SOMETHING THAT IS NOT AEGIS — `jose` on the JOSE
 * wire, `@auth0/cose` on the COSE wire — over a key the vault holds, so the
 * signature is real and what aegis does with the envelope is the only thing
 * under test. The claims are written verbatim in the wire vocabulary: a third
 * party knows no domain name, prunes nothing and stamps no type unless told to.
 *
 * ⛔ Imports nothing from `src/internal/` or `src/classes/`. The CWT claim keys
 * and the COSE labels below are written out from the specifications, so a token
 * this producer writes agrees with the RFC rather than with aegis's registry.
 */

// Duplicated on purpose from `src/internal/cose/cbor.ts#registerEncoder(Buffer`:
// importing it would tie a third party's bytes to aegis's own CBOR module, and the
// independence is what makes a raw-wire assertion over this producer worth anything.
registerEncoder(Buffer, (buffer, writer) => {
  writeUint8Array(buffer, writer);
  return undefined;
});

/** RFC 8392 §4, and RFC 9200 §8.14 for `scope`: the CWT claim keys a third party writes as integers. */
const CWT_CLAIM_KEY: ReadonlyMap<string, number> = new Map([
  ["iss", 1],
  ["sub", 2],
  ["aud", 3],
  ["exp", 4],
  ["nbf", 5],
  ["iat", 6],
  ["jti", 7],
  ["scope", 9],
]);

/** RFC 9052 §3.1 for `alg` and `kid`; RFC 9596 §2 for `typ`. */
const COSE_HEADER_LABEL = {
  alg: Headers.Algorithm,
  kid: Headers.KeyID,
  typ: 16,
} as const;

/** RFC 8392 §6 for the CWT tag; RFC 9052 §2 for the COSE_Sign1 tag. */
const CBOR_TAG = { cwt: 61, sign1: 18 } as const;

const coseAlgorithmOf = (kryptos: IKryptos): number => {
  switch (kryptos.algorithm) {
    // RFC 9053 §2.1: ES512 is COSE algorithm -36.
    case "ES512":
      return Algorithms.ES512;
    default:
      throw new Error(
        `the third-party COSE producer has no algorithm mapping for "${kryptos.algorithm}" — add one`,
      );
  }
};

/**
 * The claims as a CWT claims map: a registered claim under its integer key, every
 * other claim under its text name (RFC 8392 §3, RFC 8392 §4). RFC 8392 §3.1.7:
 * the CWT ID is a byte string, so the JOSE `jti` text is re-keyed AND re-typed.
 */
const cwtClaimsOf = (claims: Dict): Map<number | string, unknown> => {
  const map = new Map<number | string, unknown>();

  for (const [name, value] of Object.entries(claims)) {
    map.set(
      CWT_CLAIM_KEY.get(name) ?? name,
      name === "jti" ? new TextEncoder().encode(String(value)) : value,
    );
  }

  return map;
};

const signJose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
): Promise<string> => {
  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  return new CompactSign(Buffer.from(JSON.stringify(claims), "utf8"))
    .setProtectedHeader({
      alg: kryptos.algorithm,
      kid: kryptos.id,
      ...(typ === undefined ? {} : { typ }),
    })
    .sign(key);
};

const signCose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
): Promise<string> => {
  const { kty, crv, x, y, d } = kryptos.export("jwk") as Dict;

  const protectedEntries: Array<[number, unknown]> = [
    [COSE_HEADER_LABEL.alg, coseAlgorithmOf(kryptos)],
  ];

  if (typ !== undefined) protectedEntries.push([COSE_HEADER_LABEL.typ, typ]);

  const sign1 = await Sign1.sign(
    new ProtectedHeaders(protectedEntries as never),
    new UnprotectedHeaders([[COSE_HEADER_LABEL.kid, Buffer.from(kryptos.id, "utf8")]]),
    Buffer.from(encode(cwtClaimsOf(claims))),
    await COSEKey.fromJWK({ kty, crv, x, y, d } as never).toKeyLike(),
  );

  return Buffer.from(
    encode(new Tag(CBOR_TAG.cwt, new Tag(CBOR_TAG.sign1, sign1.getContentForEncoding()))),
  ).toString("base64url");
};

/** Sign `claims` as a third party would on `wire`, stamping `typ` only when one is given. */
export const signAsThirdParty = (
  wire: Wire,
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
): Promise<string> =>
  wire === "cose" ? signCose(claims, typ, kryptos) : signJose(claims, typ, kryptos);

import {
  Algorithms,
  COSEKey,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders,
} from "@auth0/cose";
import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { encode, Tag } from "cbor2";
import { registerEncoder, writeUint8Array } from "cbor2/encoder";
import { CompactSign, importJWK } from "jose";
import { subtle } from "node:crypto";
import type { Wire } from "./raw-bucket.js";

/**
 * A claims token written by SOMETHING THAT IS NOT AEGIS — `jose` on the JOSE
 * wire, `@auth0/cose` on the COSE wire — over a key the vault holds, so the
 * signature is real and what aegis does with the envelope is the only thing
 * under test. The claims are written verbatim in the wire vocabulary: a third
 * party knows no domain name, prunes nothing and stamps no type unless told to.
 *
 * A producer may also write header parameters beside the `alg` and `kid` it
 * derives from its key ({@link ForeignHeaders}) — the shapes aegis's own writers
 * refuse to produce, which are the only way to state what a READER must do
 * with one. On JOSE such a header is signed by hand with WebCrypto, because
 * `jose` refuses to write a `crit` naming a parameter the header lacks, or one
 * it has not been told it implements: a hostile or merely careless third party
 * checks neither.
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

/** A COSE map key — an int or a tstr (RFC 9052 §1.5). */
type CoseLabel = number | string;

/**
 * RFC 9052 §3.1 for `alg`, `crit`, `cty` and `kid`; RFC 9596 §4.1 for `typ`;
 * RFC 9360 §2 for `x5c` (x5chain) and `x5u`. A JOSE name with no entry is one
 * no specification registers a COSE label for, and a third party writes it
 * under its text label (RFC 9052 §1.5).
 */
const COSE_HEADER_LABEL: ReadonlyMap<string, number> = new Map([
  ["alg", 1],
  ["crit", 2],
  ["cty", 3],
  ["kid", 4],
  ["typ", 16],
  ["x5c", 33],
  ["x5u", 35],
]);

/** RFC 8392 §6 for the CWT tag; RFC 9052 §2 for the COSE_Sign1 tag. */
const CBOR_TAG = { cwt: 61, sign1: 18 } as const;

/**
 * Header parameters a third party writes beside its own `alg` and `kid`, stated
 * in the JOSE vocabulary on either wire. A COSE producer keys each at the label
 * the specifications register for it, or under its text label when none is.
 */
export type ForeignHeaders = {
  /** The integrity-protected header — the one JOSE has (RFC 7515 §7.1), COSE's first bucket (RFC 9052 §3). */
  protectedHeader?: Dict;
  /** COSE only: the second bucket, covered by nothing (RFC 9052 §3). */
  unprotectedHeader?: Dict;
  /**
   * COSE only: protected entries written under their TEXT label whatever the
   * registrations say — the integer 2 and the text `"crit"` are different labels
   * (RFC 9052 §1.5), and only a producer can put both in one bucket.
   */
  textLabelledProtected?: Dict;
};

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

const webCryptoParamsOf = (
  kryptos: IKryptos,
): { import: EcKeyImportParams; sign: EcdsaParams } => {
  switch (kryptos.algorithm) {
    // RFC 7518 §3.4: ES512 is ECDSA over P-521 with SHA-512, and the JWS
    // signature is the raw `R || S` pair WebCrypto returns.
    case "ES512":
      return {
        import: { name: "ECDSA", namedCurve: "P-521" },
        sign: { name: "ECDSA", hash: "SHA-512" },
      };
    default:
      throw new Error(
        `the hand-assembled JOSE producer has no WebCrypto mapping for "${kryptos.algorithm}" — add one`,
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

const coseLabelOf = (jose: string): CoseLabel => COSE_HEADER_LABEL.get(jose) ?? jose;

/**
 * A header value as the COSE wire carries it: `kid` is a byte string and `crit`
 * lists the labels its parameters are keyed under (RFC 9052 §3.1) — a text member
 * resolves as a parameter name does, a number is a label already. Everything else
 * travels verbatim.
 */
const coseHeaderValueOf = (jose: string, value: unknown): unknown => {
  switch (jose) {
    case "kid":
      return typeof value === "string" ? Buffer.from(value, "utf8") : value;
    case "crit":
      return Array.isArray(value)
        ? value.map((member: unknown) =>
            typeof member === "string" ? coseLabelOf(member) : member,
          )
        : value;
    default:
      return value;
  }
};

const coseEntriesOf = (bag: Dict | undefined): Array<[CoseLabel, unknown]> =>
  Object.entries(bag ?? {}).map(([jose, value]) => [
    coseLabelOf(jose),
    coseHeaderValueOf(jose, value),
  ]);

const b64u = (value: Buffer | string): string =>
  (Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8")).toString("base64url");

/**
 * A compact serialisation assembled by hand: `BASE64URL(header) . BASE64URL(payload)`
 * signed with WebCrypto over exactly that signing input (RFC 7515 §5.1,
 * RFC 7515 §7.1). The signature is real, so a verdict on such a token is the
 * header's and never the signature's.
 */
const signCompactByHand = async (
  header: Dict,
  payload: Buffer,
  kryptos: IKryptos,
): Promise<string> => {
  const params = webCryptoParamsOf(kryptos);
  const { kty, crv, x, y, d } = kryptos.export("jwk") as Dict;
  const key = await subtle.importKey("jwk", { kty, crv, x, y, d }, params.import, false, [
    "sign",
  ]);

  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(payload)}`;
  const signature = await subtle.sign(
    params.sign,
    key,
    Buffer.from(signingInput, "utf8"),
  );

  return `${signingInput}.${b64u(Buffer.from(signature))}`;
};

const signJose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  headers: ForeignHeaders,
): Promise<string> => {
  if (headers.unprotectedHeader !== undefined) {
    throw new Error(
      "a JOSE compact serialisation carries one header and it is protected (RFC 7515 §7.1): there is no unprotected bucket for a producer to write",
    );
  }

  if (headers.textLabelledProtected !== undefined) {
    throw new Error(
      "a JOSE header is a JSON object with one kind of member name (RFC 7515 §4): there is no second label form for a producer to write",
    );
  }

  // The producer's own parameters first, so a stated one can restate them.
  const header: Dict & { alg: string } = {
    alg: kryptos.algorithm,
    kid: kryptos.id,
    ...(typ === undefined ? {} : { typ }),
    ...headers.protectedHeader,
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8");

  if (headers.protectedHeader !== undefined) {
    return signCompactByHand(header, payload, kryptos);
  }

  const key = await importJWK(kryptos.export("jwk") as never, kryptos.algorithm);

  return new CompactSign(payload).setProtectedHeader(header).sign(key);
};

const signCose = async (
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  headers: ForeignHeaders,
): Promise<string> => {
  const { kty, crv, x, y, d } = kryptos.export("jwk") as Dict;

  const protectedEntries: Array<[CoseLabel, unknown]> = [
    [coseLabelOf("alg"), coseAlgorithmOf(kryptos)],
  ];

  if (typ !== undefined) protectedEntries.push([coseLabelOf("typ"), typ]);

  protectedEntries.push(...coseEntriesOf(headers.protectedHeader));
  // Verbatim under the text label, whatever the registrations say.
  protectedEntries.push(...Object.entries(headers.textLabelledProtected ?? {}));

  // The producer's own `kid` first, so a stated one is written beside it, never
  // in place of it: it is the routing hint a reader resolves the key by.
  const unprotectedEntries: Array<[CoseLabel, unknown]> = [
    [coseLabelOf("kid"), Buffer.from(kryptos.id, "utf8")],
    ...coseEntriesOf(headers.unprotectedHeader),
  ];

  const sign1 = await Sign1.sign(
    new ProtectedHeaders(protectedEntries as never),
    new UnprotectedHeaders(unprotectedEntries as never),
    Buffer.from(encode(cwtClaimsOf(claims))),
    await COSEKey.fromJWK({ kty, crv, x, y, d } as never).toKeyLike(),
  );

  return Buffer.from(
    encode(new Tag(CBOR_TAG.cwt, new Tag(CBOR_TAG.sign1, sign1.getContentForEncoding()))),
  ).toString("base64url");
};

/**
 * Sign `claims` as a third party would on `wire`, stamping `typ` only when one
 * is given and writing `headers` beside the parameters it derives from its key.
 */
export const signAsThirdParty = (
  wire: Wire,
  claims: Dict,
  typ: string | undefined,
  kryptos: IKryptos,
  headers: ForeignHeaders = {},
): Promise<string> =>
  wire === "cose"
    ? signCose(claims, typ, kryptos, headers)
    : signJose(claims, typ, kryptos, headers);

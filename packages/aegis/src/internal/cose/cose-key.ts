import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../constants/format.js";
import { CoseError } from "../../errors/index.js";
import {
  COSE_CNF_LABELS,
  COSE_CNF_MEMBERS,
  type CoseCnfMember,
} from "../claims/cnf-members.js";

// COSE_Key parameter labels (RFC 9052 §7).
const KEY = { kty: 1, kid: 2, alg: 3, crv: -1, x: -2, y: -3 } as const;

// AKP (Algorithm Key Pair) key parameter labels (RFC 9964 §5): the raw ML-DSA
// public key `pub` and 32-byte seed `priv`, both `bstr`. The integer labels
// (-1/-2) coincide with the EC2/OKP crv/x labels but are kty-scoped, so they
// carry a different meaning under kty 7.
const AKP = { pub: -1, priv: -2 } as const;

// kty labels (JWK kty -> COSE). JWK "EC" is COSE "EC2" (2); "AKP" is 7 (RFC 9964).
export const KTY_TO_COSE: Readonly<Record<string, number>> = {
  OKP: 1,
  EC: 2,
  RSA: 3,
  oct: 4,
  AKP: 7,
};
const COSE_TO_KTY: Readonly<Record<number, string>> = {
  1: "OKP",
  2: "EC",
  3: "RSA",
  4: "oct",
  7: "AKP",
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
 * Convert a JWK to a COSE_Key map (RFC 9052 §7). EC2 and OKP public keys and AKP
 * (RFC 9964 ML-DSA — `pub`, optional `priv` seed) keys are supported; RSA/oct
 * cnf keys are not yet handled.
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

  if (jwk.kty === "AKP") {
    if (typeof jwk.pub !== "string") unsupported("AKP COSE_Key requires a 'pub' member.");
    key.set(AKP.pub, B64.toBuffer(jwk.pub as string, B64U));
    if (typeof jwk.priv === "string") key.set(AKP.priv, B64.toBuffer(jwk.priv, B64U));
    return key;
  }

  return unsupported("Only EC2, OKP, and AKP COSE_Key conversion is supported.");
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

  if (kty === "AKP") {
    const pub = key.get(AKP.pub);
    if (!(pub instanceof Uint8Array))
      unsupported("AKP COSE_Key requires a 'pub' member.");
    jwk.pub = B64.encode(Buffer.from(pub as Uint8Array), B64U);
    const priv = key.get(AKP.priv);
    if (priv instanceof Uint8Array) jwk.priv = B64.encode(Buffer.from(priv), B64U);
    return jwk;
  }

  return unsupported("Only EC2, OKP, and AKP COSE_Key conversion is supported.");
};

/**
 * A member that HAS a COSE label and a PRESENT value that cannot be written
 * under it.
 *
 * ⚠ This is a REFUSAL where the code used to drop silently. `cnf.kid = 42` failed
 * the string guard and simply produced no entry, so a `{ jwk, kid: 42 }`
 * confirmation minted with the key alone — a token asserting a binding narrower
 * than the one its author wrote. That is the same silent-PoP-drop the per-member
 * membership filter below was added to close, one level further in.
 *
 * ⚠ PRESENT is the whole scope. A member whose value is `undefined` is ABSENT —
 * that is how absence is spelled here — and never reaches this; the caller
 * supplied nothing, not something broken. `null`, `42` and `"not-a-jwk"` are
 * supplied values, and this is their answer.
 */
const unencodable = (member: CoseCnfMember, detail: string): never => {
  throw new CoseError(`Confirmation member "${member}" cannot be encoded`, {
    code: "cose_cnf_member_invalid",
    data: { member },
    title: "COSE Confirmation Member Invalid",
    details: `The cnf ${member} is present but ${detail}, so the confirmation cannot be written. A member that cannot be encoded fails closed rather than being dropped, which would mint a token claiming a binding it does not carry.`,
  });
};

/**
 * The unhandled-branch refusal — see the `never` defaults below. It is
 * unreachable while the switches are exhaustive, and it exists because
 * `noImplicitReturns` is off repo-wide: without it a member added to
 * {@link COSE_CNF_LABELS} would encode as `undefined` instead of failing.
 */
const unhandledCnfMember = (member: never, direction: "written" | "read"): never => {
  throw new CoseError("Unhandled COSE confirmation member", {
    code: "cose_cnf_unhandled_member",
    data: { member: String(member) },
    title: "Unhandled COSE Confirmation Member",
    details: `The COSE cnf label table declares a member this codec has no branch for, so the confirmation cannot be ${direction}.`,
  });
};

/**
 * One member's COSE value, from the JOSE `cnf`.
 *
 * ⚠ It takes the VALUE, not the bag — the twin of `decodeCnfMember` below, and
 * for the same reason. Reading `cnf.jwk` inside `case "jwk"` spells the
 * discriminant and the read SEPARATELY, so a copy-paste that leaves the wrong
 * property name behind compiles and silently encodes the wrong member under the
 * right label. The caller reads `cnf[member]` once; there is nothing left to
 * mismatch.
 */
const encodeCnfMember = (member: CoseCnfMember, value: unknown): unknown => {
  switch (member) {
    case "jwk":
      return isObject(value)
        ? jwkToCoseKey(value)
        : unencodable(member, "not a JWK object");

    case "kid":
      // ⚠ MALFORMED only — the shape, not the content. An EMPTY string is a
      // string and is written as a zero-length bstr, exactly as it always has
      // been. A special case refusing it briefly lived here and was reverted:
      // "empty = refused" is a rule for ONE normalisation door applied once, and
      // enforcing it in this codec put it on the COSE wire alone, which made a
      // single domain call answer differently per format.
      return isString(value)
        ? Buffer.from(value, "utf8")
        : unencodable(member, "not a string");

    default:
      return unhandledCnfMember(member, "written");
  }
};

/** One member's JOSE value, from the COSE cnf map — the read twin. */
const decodeCnfMember = (member: CoseCnfMember, value: unknown): unknown => {
  switch (member) {
    case "jwk":
      return value instanceof Map ? coseKeyToJwk(value) : undefined;

    case "kid":
      // A zero-length bstr reconstructs to `""`, the value it encodes. It is NOT
      // normalised to absent: doing so made a foreign `cnf:{"kid":""}` verify on
      // COSE and be refused on JOSE, which is the read-side twin of the write
      // divergence the encoder note above records.
      return value instanceof Uint8Array
        ? Buffer.from(value).toString("utf8")
        : undefined;

    default:
      return unhandledCnfMember(member, "read");
  }
};

/**
 * Encode the JOSE `cnf` to a COSE cnf map (RFC 8747): an embedded public key
 * (`jwk`) -> COSE_Key (label 1), a key id (`kid`) -> kid (label 3). Since Phase
 * 5 the translator (`domainToCose`) already mapped the domain confirmation to its
 * JOSE `cnf` member names, so this accepts `{ jwk, kid, jkt, x5t#S256, jku }` (the
 * JOSE cnf), NOT the domain `{ key, keyId, thumbprint }`. The thumbprint-only
 * forms (`jkt`/`x5t#S256`/`jku`) have no COSE cnf representation (jkt ≠ ckt) and
 * are rejected.
 *
 * ⚠ The labels are NOT written here. They come from `COSE_CNF_LABELS`, which is
 * also what derives the capability row, so the set a caller is told is
 * representable and the set this writes are one thing.
 */
export const encodeCnf = (cnf: Dict): Map<number, unknown> => {
  // Refuse PER MEMBER, not per map. The refusal used to fire only when the output
  // map came out EMPTY, so a MIXED confirmation — a thumbprint alongside a key id
  // — silently dropped the thumbprint, kept the key id, and minted an UNBOUND
  // BEARER CWT that verify never asked for a proof of possession for. A token
  // that claims to be bound but is not is strictly worse than a bearer token,
  // because the verifier stops asking.
  // ⚠ `Object.hasOwn`, NOT `in`. `in` walks the PROTOTYPE CHAIN, so
  // `"constructor" in COSE_CNF_LABELS` is `true` and a caller's `constructor`
  // member would pass this filter as representable — then never be written by
  // the loop below, which iterates the table's own keys. With one real member
  // beside it the map is non-empty, the emptiness guard stays silent, and the
  // token mints with the member DROPPED: the very defect this filter exists to
  // close, re-entered through the object literal. A `ReadonlySet` had no such
  // hole; a plain object does, so the lookup has to say `hasOwn`.
  //
  // ⚠ And it filters on the VALUE, not on key presence, so `undefined` means
  // ABSENT here exactly as it does in the write loop below. A key list reports a
  // key whatever it holds, so filtering on presence alone made the SAME
  // `undefined` mean "absent" for `jwk`/`kid` and "present and unrepresentable"
  // for `jkt`/`x5t#S256`/`jku` — one function, two meanings for one value. A
  // caller assembling `{ jkt: claim.thumbprint, … }` with no thumbprint supplied
  // nothing, and there is no member to fail closed over.
  // ⚠ `Reflect.ownKeys`, and this WAS `Object.keys`, which is own-ENUMERABLE.
  // The write loop's `Object.hasOwn` includes non-enumerable own keys, so a
  // non-enumerable own member was neither flagged here nor written there — a
  // silent drop, since the map still comes out non-empty beside a valid member.
  // The two lookups have to ask the same question. Symbols are dropped: a symbol
  // key is not a cnf member name and has no label.
  const unrepresentable = Reflect.ownKeys(cnf)
    .filter((member) => isString(member))
    .filter(
      (member) => cnf[member] !== undefined && !Object.hasOwn(COSE_CNF_LABELS, member),
    );

  if (unrepresentable.length) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      data: { members: unrepresentable, supported: [...COSE_CNF_MEMBERS] },
      title: "COSE Confirmation Unsupported",
      details:
        "Only an embedded key (jwk -> COSE_Key) or kid (-> kid) can go in a COSE cnf; jkt/x5t#S256/jku have no COSE form. A JOSE thumbprint cannot be relabelled as a COSE one — RFC 7638 hashes a key's canonical JSON and RFC 9679 its canonical CBOR, so the same key yields different bytes — so a confirmation this wire cannot carry fails closed rather than being dropped.",
    });
  }

  const out = new Map<number, unknown>();

  for (const member of COSE_CNF_MEMBERS) {
    // ⚠ ABSENT means `undefined`, not "the key is missing". `undefined` is how
    // absence is spelled throughout this package — `omitUndefined` is the domain
    // layer's own tool for it — so `{ jwk: undefined, kid }` is a caller who
    // supplied no key, and refusing it would reject a confirmation this wire
    // carries perfectly well. A key-PRESENCE test (`in`) would refuse it, and
    // only the standalone `CwtKit.sign`/`CwmKit.sign` door can produce that
    // shape: the domain path builds its cnf through `omitUndefined` already.
    // ⚠ `undefined` ONLY. An EMPTY string is a supplied value and is written;
    // "empty = refused" belongs to one normalisation door applied once, not to
    // this codec, where it would bind the COSE wire alone.
    //
    // `null` is deliberately NOT absent. It is a value, and not one this codec
    // can write, so it goes to `encodeCnfMember` and is refused.
    // ⚠⚠ THIS IS THE PACKAGE'S ONE EXCEPTION TO "null IS ABSENCE"
    // (`internal/claims/is-not-stated.ts`), and it is stated in the presence-notion
    // table in `internal/utils/rules/index.ts` so it is not a fifth decision
    // outside the map. It holds only because the TRANSLATOR agrees: when `cnf`
    // briefly took the null carve-out, the member was erased in `domainToWire`
    // before this loop ever ran, so the fail-closed guard — the `unrepresentable`
    // check ABOVE, at the top of this function, not below this line — saw nothing
    // to report and `mint("cwt", { thumbprint: null, keyId })` minted an UNBOUND
    // CWT.
    // A guard that tests `!== undefined` cannot defend a value someone upstream
    // already turned into `undefined`.
    // ⚠ `Object.hasOwn` HERE TOO, matching the filter above. The filter reads
    // `Reflect.ownKeys` (own keys only), so an INHERITED member is never flagged
    // unrepresentable — and if this loop then read it off the prototype the two
    // lookups would disagree in the other direction, writing a member the caller
    // never set on the object. It cannot silently drop, but the two lookups must
    // answer the same question or one of them is deciding something alone.
    if (!Object.hasOwn(cnf, member) || cnf[member] === undefined) continue;

    out.set(COSE_CNF_LABELS[member], encodeCnfMember(member, cnf[member]));
  }

  if (out.size === 0) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      data: { members: Object.keys(cnf), supported: [...COSE_CNF_MEMBERS] },
      title: "COSE Confirmation Unsupported",
      details:
        "Only an embedded key (jwk -> COSE_Key) or kid (-> kid) can go in a COSE cnf, and neither was present in a usable shape.",
    });
  }

  return out;
};

/**
 * Decode a COSE cnf map back to the JOSE `cnf` shape (`{ jwk, kid }`) — the read
 * twin of {@link encodeCnf}, over the same label table. A member a foreign
 * producer wrote in a shape this codec cannot read is OMITTED rather than
 * refused: the read side reports what it could recover, and the confirmation is
 * then judged by whoever asked for the binding.
 */
export const decodeCnf = (cnf: Map<number, unknown>): Dict => {
  const out: Dict = {};

  for (const member of COSE_CNF_MEMBERS) {
    const decoded = decodeCnfMember(member, cnf.get(COSE_CNF_LABELS[member]));

    if (decoded !== undefined) out[member] = decoded;
  }

  return out;
};

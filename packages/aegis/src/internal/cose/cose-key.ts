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
import { ownEntry } from "./own-entry.js";

// COSE_Key parameter labels (RFC 9052 §7).
const KEY = { kty: 1, kid: 2, alg: 3, crv: -1, x: -2, y: -3 } as const;

// AKP key parameter labels, RFC 9964 §3. ⚠ -1/-2 coincide with the EC2/OKP
// crv/x labels but are kty-scoped, so they mean something else under kty 7.
const AKP = { pub: -1, priv: -2 } as const;

// kty labels, JWK -> COSE. ⚠ JWK "EC" is COSE "EC2" (2), not 1.
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
 * An EC2/OKP coordinate off a FOREIGN COSE_Key. RFC 9052 §7.1.
 *
 * ⚠ It tests the TYPE, not presence, and both halves matter. Absent reaches
 * `Buffer.from(undefined)` and throws a raw `TypeError` out of the keyless
 * `CwtKit.decode`/`CwmKit.decode` door (see `decode-cwt-wire.ts`); a tstr does
 * NOT crash — `Buffer.from("not-a-bstr")` succeeds as UTF-8 and hands back a
 * confirmation key nobody supplied.
 */
const coordinate = (value: unknown, member: "x" | "y"): Buffer =>
  value instanceof Uint8Array
    ? Buffer.from(value)
    : unsupported(`COSE_Key '${member}' is absent or is not a byte string.`);

/**
 * Convert a JWK to a COSE_Key map (RFC 9052 §7). EC2, OKP and AKP (RFC 9964 §3)
 * keys only; RSA/oct cnf keys are not handled.
 */
export const jwkToCoseKey = (jwk: Dict): Map<number, unknown> => {
  // ⚠ `ownEntry`, never `table[key]`: `jwk` is the caller's bag and a JSON body
  // can spell `kty`/`crv` as an `Object.prototype` member name. See own-entry.ts.
  const ktyLabel = ownEntry(KTY_TO_COSE, jwk.kty);
  if (ktyLabel === undefined) unsupported(`Unknown JWK kty "${jwk.kty}".`);

  const key = new Map<number, unknown>();
  key.set(KEY.kty, ktyLabel);
  if (isString(jwk.kid)) key.set(KEY.kid, Buffer.from(jwk.kid, "utf8"));

  if (jwk.kty === "EC" || jwk.kty === "OKP") {
    const crvLabel = ownEntry(CRV_TO_COSE, jwk.crv);
    if (crvLabel === undefined) unsupported(`Unknown curve "${jwk.crv}".`);
    key.set(KEY.crv, crvLabel);
    // ⚠ The write twin of {@link coordinate}, needing its own guard: here the
    // coordinate is a base64url STRING off the caller's `cnf.jwk`, not a bstr off
    // a token, so `B64.toBuffer(undefined)` throws a raw `TypeError` at mint.
    if (!isString(jwk.x)) unsupported("EC2/OKP COSE_Key requires an 'x' member.");
    key.set(KEY.x, B64.toBuffer(jwk.x as string, B64U));

    if (jwk.kty === "EC") {
      if (!isString(jwk.y)) unsupported("EC2 COSE_Key requires a 'y' member.");
      key.set(KEY.y, B64.toBuffer(jwk.y as string, B64U));
    }
    return key;
  }

  if (jwk.kty === "AKP") {
    if (!isString(jwk.pub)) unsupported("AKP COSE_Key requires a 'pub' member.");
    key.set(AKP.pub, B64.toBuffer(jwk.pub as string, B64U));
    if (isString(jwk.priv)) key.set(AKP.priv, B64.toBuffer(jwk.priv, B64U));
    return key;
  }

  return unsupported("Only EC2, OKP, and AKP COSE_Key conversion is supported.");
};

/** Convert a COSE_Key map back to a public JWK. */
export const coseKeyToJwk = (key: Map<number, unknown>): Dict => {
  // ⚠ Every label here comes off a FOREIGN token — `decodeCnf` reaches this on any
  // CWT read — so the tables go through `ownEntry`, never a direct index. See
  // own-entry.ts.
  const kty = ownEntry(COSE_TO_KTY, key.get(KEY.kty));
  if (kty === undefined) unsupported("Unknown COSE_Key kty.");

  const jwk: Dict = { kty };
  const kid = key.get(KEY.kid);
  if (kid instanceof Uint8Array) jwk.kid = Buffer.from(kid).toString("utf8");

  if (kty === "EC" || kty === "OKP") {
    // Fail closed, as `kty` does one line up: an unnameable curve label is refused
    // rather than written onto the JWK a caller may act on.
    const crv = ownEntry(COSE_TO_CRV, key.get(KEY.crv));
    if (crv === undefined) unsupported("Unknown COSE_Key crv.");

    jwk.crv = crv;
    jwk.x = B64.encode(coordinate(key.get(KEY.x), "x"), B64U);
    if (kty === "EC") jwk.y = B64.encode(coordinate(key.get(KEY.y), "y"), B64U);
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
 * A member that HAS a COSE label and a PRESENT value that cannot be written under
 * it. ⚠ It REFUSES rather than dropping: dropping `{ jwk, kid: 42 }` down to the
 * key alone mints a token asserting a narrower binding than its author wrote.
 *
 * ⚠ PRESENT is the whole scope. `undefined` is how absence is spelled here and
 * never reaches this; `null`, `42` and `"not-a-jwk"` are supplied values.
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
 * ⚠ It takes the VALUE, not the bag — as `decodeCnfMember` below does. Reading
 * `cnf.jwk` inside `case "jwk"` spells the discriminant and the read separately,
 * so a copy-paste compiles and encodes the wrong member under the right label.
 */
const encodeCnfMember = (member: CoseCnfMember, value: unknown): unknown => {
  switch (member) {
    case "jwk":
      return isObject(value)
        ? jwkToCoseKey(value)
        : unencodable(member, "not a JWK object");

    case "kid":
      // ⚠ Shape only, not content. An EMPTY string is written as a zero-length
      // bstr: "empty = refused" belongs to one normalisation door applied once,
      // and enforcing it here binds the COSE wire alone, so one domain call would
      // answer differently per format.
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
      // A zero-length bstr reconstructs to `""`, not to absent — normalising it
      // away makes a foreign `cnf:{"kid":""}` verify on COSE and be refused on
      // JOSE. Read-side twin of the encoder note above.
      return value instanceof Uint8Array
        ? Buffer.from(value).toString("utf8")
        : undefined;

    default:
      return unhandledCnfMember(member, "read");
  }
};

/**
 * Encode the JOSE `cnf` to a COSE cnf map (RFC 8747 §3.1).
 *
 * ⚠ It takes the JOSE cnf — `{ jwk, kid, jkt, x5t#S256, jku }` — not the domain
 * `{ key, keyId, thumbprint }`; `domainToWire` has already mapped the names. The
 * thumbprint-only forms have no COSE cnf representation and are refused.
 *
 * ⚠ The labels come from `COSE_CNF_LABELS`, which also derives the capability
 * row, so what a caller is told is representable and what this writes are one set.
 */
export const encodeCnf = (cnf: Dict): Map<number, unknown> => {
  // ⚠ Refuse PER MEMBER, not per map: the emptiness guard below stays silent for a
  // MIXED confirmation, so a thumbprint beside a key id drops and mints an UNBOUND
  // CWT that verify never asks a proof of possession for.
  //
  // ⚠ `Object.hasOwn`, NOT `in` — `in` walks the prototype chain, so a caller's
  // `constructor` member passes as representable here and is never written by the
  // loop below, which is that same silent drop re-entered through the table's
  // object literal.
  //
  // ⚠ It filters on the VALUE, not key presence, so `undefined` means ABSENT here
  // exactly as in the write loop below — otherwise one `undefined` means "absent"
  // for `jwk`/`kid` and "present and unrepresentable" for the thumbprint forms.
  //
  // ⚠ `Reflect.ownKeys`, not `Object.keys`: the write loop's `Object.hasOwn` sees
  // non-enumerable own keys, and a member neither flagged here nor written there
  // drops silently. Symbols have no label and are dropped.
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
        "aegis writes only an embedded key (jwk -> COSE_Key) and a kid (-> kid) into a COSE cnf; jkt/x5t#S256/jku have no COSE label here. A JOSE thumbprint cannot be relabelled as a COSE one — one digests a canonical JSON JWK and the other a deterministically encoded COSE_Key, so the same key yields different bytes — so a confirmation this wire cannot carry fails closed rather than being dropped. RFC 7638 §3, RFC 9679 §3.",
    });
  }

  const out = new Map<number, unknown>();

  for (const member of COSE_CNF_MEMBERS) {
    // ⚠ ABSENT means `undefined` only — the spelling `omitUndefined` produces — so
    // `{ jwk: undefined, kid }` is a caller who supplied no key. An EMPTY string is
    // a supplied value and is written.
    //
    // ⚠⚠ `null` is NOT absence here, the package's one exception to
    // `internal/claims/is-not-stated.ts`, recorded in the presence-notion table in
    // `internal/utils/rules/index.ts`. It holds only while the TRANSLATOR agrees:
    // give `cnf` the null carve-out in `domainToWire` and the member is erased
    // before this loop runs, so the `unrepresentable` guard above reports nothing
    // and `mint("cwt", { thumbprint: null, keyId })` mints an UNBOUND CWT.
    //
    // ⚠ `Object.hasOwn` here too, matching the filter above: reading an INHERITED
    // member off the prototype writes one the caller never set, so the two lookups
    // must ask the same question.
    if (!Object.hasOwn(cnf, member) || cnf[member] === undefined) continue;

    out.set(COSE_CNF_LABELS[member], encodeCnfMember(member, cnf[member]));
  }

  if (out.size === 0) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      data: { members: Object.keys(cnf), supported: [...COSE_CNF_MEMBERS] },
      title: "COSE Confirmation Unsupported",
      details:
        "aegis writes only an embedded key (jwk -> COSE_Key) and a kid (-> kid) into a COSE cnf, and neither was present in a usable shape.",
    });
  }

  return out;
};

/**
 * Decode a COSE cnf map back to the JOSE `cnf` shape — the read twin of
 * {@link encodeCnf}, over the same label table. RFC 8747 §3.1. A MEMBER written
 * in a shape this codec cannot read is OMITTED, not refused: the read side
 * reports what it recovered, and whoever asked for the binding judges it.
 *
 * ⚠ The CONTAINER is the exception, and it takes `unknown` so the guard cannot be
 * cast away at the call site. `cwt-spec.ts` feeds it whatever CBOR the token
 * carried, and `preferMap: false` hands back a plain OBJECT for a wholly
 * text-keyed map — `cnf.get is not a function`, a raw `TypeError` out of the
 * keyless `CwtKit.decode`/`CwmKit.decode` door (see `decode-cwt-wire.ts`).
 *
 * ⛔ It must NOT degrade to `{}`: a token that DECLARES a confirmation would then
 * read back as unbound, presenting a sender-constrained token as a bearer one to
 * every check downstream.
 */
export const decodeCnf = (cnf: unknown): Dict => {
  if (!(cnf instanceof Map)) {
    throw new CoseError("Confirmation is not a COSE map", {
      code: "cose_cnf_unsupported",
      data: { claim: "cnf", label: 8 },
      title: "COSE Confirmation Unsupported",
      details:
        "aegis reads a CWT confirmation as a CBOR map of confirmation members; this token carries something else, so the binding it declares cannot be read. RFC 8747 §3.1.",
    });
  }

  const out: Dict = {};

  for (const member of COSE_CNF_MEMBERS) {
    const decoded = decodeCnfMember(member, cnf.get(COSE_CNF_LABELS[member]));

    if (decoded !== undefined) out[member] = decoded;
  }

  return out;
};

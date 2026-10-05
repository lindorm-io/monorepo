import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../constants/format.js";
import { CoseError } from "../../errors/index.js";
import { ownIntEntry, ownTextEntry } from "./own-entry.js";
import type { RegisteredLabel } from "./registered-labels.js";

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
  // ⚠ `ownTextEntry`, never `table[key]`: `jwk` is the caller's bag and a JSON body
  // can spell `kty`/`crv` as an `Object.prototype` member name. The table is keyed
  // by the JWK name, so a JWK spelling one as a number has none. See own-entry.ts.
  const ktyLabel = ownTextEntry(KTY_TO_COSE, jwk.kty);
  if (ktyLabel === undefined) unsupported(`Unknown JWK kty "${jwk.kty}".`);

  const key = new Map<number, unknown>();
  key.set(KEY.kty, ktyLabel);
  if (isString(jwk.kid)) key.set(KEY.kid, Buffer.from(jwk.kid, "utf8"));

  if (jwk.kty === "EC" || jwk.kty === "OKP") {
    const crvLabel = ownTextEntry(CRV_TO_COSE, jwk.crv);
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
  // ⚠ Every value here comes off a FOREIGN token — `decodeCnf` reaches this on any
  // CWT read — so the tables go through `ownIntEntry`, never a direct index. A
  // COSE_Key kty is `tstr / int` (RFC 9052 §7.1 Table 4) and a crv `int / tstr`
  // (RFC 9053 §7.1.1 Table 19); these tables are keyed by the registered INTEGER, so
  // a text value is unregistered and refused below. See own-entry.ts.
  const kty = ownIntEntry(COSE_TO_KTY, key.get(KEY.kty));
  if (kty === undefined) unsupported("Unknown COSE_Key kty.");

  const jwk: Dict = { kty };
  const kid = key.get(KEY.kid);
  if (kid instanceof Uint8Array) jwk.kid = Buffer.from(kid).toString("utf8");

  if (kty === "EC" || kty === "OKP") {
    // Fail closed, as `kty` does one line up: an unnameable curve label is refused
    // rather than written onto the JWK a caller may act on.
    const crv = ownIntEntry(COSE_TO_CRV, key.get(KEY.crv));
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
const unencodableDetails = (member: string, detail: string): string =>
  `The cnf ${member} is present but ${detail}, so the confirmation cannot be written. A member that cannot be encoded fails closed rather than being dropped, which would mint a token claiming a binding it does not carry.`;

/**
 * One member's COSE value, from the JOSE `cnf`, by the table entry's codec.
 *
 * ⚠ It takes the VALUE, not the bag — as `decodeCnfMember` below does. Reading
 * `cnf[entry.name]` inside the switch spells the discriminant and the read
 * separately, so a copy-paste compiles and encodes the wrong member under the
 * right label.
 *
 * ⚠ The `never` default is unreachable while the switch is exhaustive over
 * `RegisteredCodec` (`registered-labels.ts`), and it exists because
 * `noImplicitReturns` is off repo-wide: without it a codec added to that union
 * would encode as `undefined` instead of failing.
 */
const encodeCnfMember = (entry: RegisteredLabel, value: unknown): unknown => {
  switch (entry.codec.kind) {
    case "coseKey":
      if (isObject(value)) return jwkToCoseKey(value);

      throw new CoseError(`Confirmation member "${entry.name}" cannot be encoded`, {
        code: "cose_cnf_member_invalid",
        data: { member: entry.name },
        title: "COSE Confirmation Member Invalid",
        details: unencodableDetails(entry.name, "not a JWK object"),
      });

    case "bstr":
      // ⚠ Shape only, not content. An EMPTY string is written as a zero-length
      // bstr: "empty = refused" belongs to one normalisation door applied once,
      // and enforcing it here binds the COSE wire alone, so one domain call would
      // answer differently per format.
      if (isString(value)) return Buffer.from(value, entry.codec.encoding);

      throw new CoseError(`Confirmation member "${entry.name}" cannot be encoded`, {
        code: "cose_cnf_member_invalid",
        data: { member: entry.name },
        title: "COSE Confirmation Member Invalid",
        details: unencodableDetails(entry.name, "not a string"),
      });

    default: {
      const exhaustive: never = entry.codec;
      throw new CoseError("Unhandled COSE confirmation member codec", {
        code: "cose_cnf_unhandled_codec",
        data: { codec: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled COSE Confirmation Member Codec",
        details:
          "The registered label table declares a member codec this codec has no branch for, so the confirmation cannot be written.",
      });
    }
  }
};

/** One member's JOSE value, from the COSE cnf map — the read twin. */
const decodeCnfMember = (entry: RegisteredLabel, value: unknown): unknown => {
  switch (entry.codec.kind) {
    case "coseKey":
      return value instanceof Map ? coseKeyToJwk(value) : undefined;

    case "bstr":
      // A zero-length bstr reconstructs to `""`, not to absent — normalising it
      // away makes a foreign `cnf:{"kid":""}` verify on COSE and be refused on
      // JOSE. Read-side twin of the encoder note above.
      return value instanceof Uint8Array
        ? Buffer.from(value).toString(entry.codec.encoding)
        : undefined;

    default: {
      const exhaustive: never = entry.codec;
      throw new CoseError("Unhandled COSE confirmation member codec", {
        code: "cose_cnf_unhandled_codec",
        data: { codec: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled COSE Confirmation Member Codec",
        details:
          "The registered label table declares a member codec this codec has no branch for, so the confirmation cannot be read.",
      });
    }
  }
};

/**
 * Encode the JOSE `cnf` to a COSE cnf map (RFC 8747 §3.1), by the registered label
 * table the caller derived from the member declaration (`registered-labels.ts`).
 *
 * ⚠ It takes the JOSE cnf — `{ jwk, kid, jkt, x5t#S256, jku }` — not the domain
 * `{ key, keyId, thumbprint }`; `domainToWire` has already mapped the names. The
 * thumbprint-only forms have no COSE cnf representation and are refused.
 *
 * ⚠ The table and the COSE capability row are both derived from the members'
 * `wire.cose` cells (`internal/claims/cnf-members.ts`), and
 * `kit-capabilities.test.ts` holds the two to one set, so what a caller is told
 * is representable and what this writes cannot drift apart.
 */
export const encodeCnf = (
  cnf: Dict,
  labels: ReadonlyArray<RegisteredLabel>,
): Map<number, unknown> => {
  // ⚠ A `Set` of the table's names, never an object literal indexed by the
  // caller's key: an index read walks the prototype chain, so a caller's
  // `constructor` member would pass as representable and never be written by the
  // loop below — a silent drop.
  const named = new Set(labels.map((entry) => entry.name));
  const supported = labels.map((entry) => entry.name);

  // ⚠ Refuse PER MEMBER, not per map: the emptiness guard below stays silent for a
  // MIXED confirmation, so a thumbprint beside a key id drops and mints an UNBOUND
  // CWT that verify never asks a proof of possession for.
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
    .filter((member) => cnf[member] !== undefined && !named.has(member));

  if (unrepresentable.length) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      data: { members: unrepresentable, supported },
      title: "COSE Confirmation Unsupported",
      details:
        "aegis writes only an embedded key (jwk -> COSE_Key) and a kid (-> kid) into a COSE cnf; jkt/x5t#S256/jku have no COSE label here. A JOSE thumbprint cannot be relabelled as a COSE one — one digests a canonical JSON JWK and the other a deterministically encoded COSE_Key, so the same key yields different bytes — so a confirmation this wire cannot carry fails closed rather than being dropped. RFC 7638 §3, RFC 9679 §3.",
    });
  }

  const out = new Map<number, unknown>();

  for (const entry of labels) {
    // ⚠ ABSENT means `undefined` only — the spelling `omitUndefined` produces — so
    // `{ jwk: undefined, kid }` is a caller who supplied no key. An EMPTY string is
    // a supplied value and is written.
    //
    // ⚠⚠ `null` is NOT absence here, the package's one exception to
    // `internal/claims/is-not-stated.ts`, recorded in the presence-notion table in
    // `internal/utils/rules/index.ts`. It holds only while the TRANSLATOR agrees:
    // the confirmation's `binds: "key"` cell (`internal/registry/claim-spec.ts`)
    // is what keeps the walker from erasing a null member before this loop runs;
    // under `"none"` the `unrepresentable` guard above would report nothing and
    // `mint("cwt", { thumbprint: null, keyId })` would mint an UNBOUND CWT.
    //
    // ⚠ `Object.hasOwn` here too, matching the filter above: reading an INHERITED
    // member off the prototype writes one the caller never set, so the two lookups
    // must ask the same question.
    if (!Object.hasOwn(cnf, entry.name) || cnf[entry.name] === undefined) continue;

    out.set(entry.label, encodeCnfMember(entry, cnf[entry.name]));
  }

  if (out.size === 0) {
    throw new CoseError("Confirmation has no COSE-representable member", {
      code: "cose_cnf_unsupported",
      data: { members: Object.keys(cnf), supported },
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
export const decodeCnf = (cnf: unknown, labels: ReadonlyArray<RegisteredLabel>): Dict => {
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

  // ⚠ Only the table's labels are read; every other key — a label this registry
  // does not hold, a text key — is dropped, so a member cannot arrive twice under
  // two renderings. `out[entry.name]` is a bare write and SAFE: the name comes from
  // the registry's own declaration, never from the token.
  for (const entry of labels) {
    const decoded = decodeCnfMember(entry, cnf.get(entry.label));

    if (decoded !== undefined) out[entry.name] = decoded;
  }

  return out;
};

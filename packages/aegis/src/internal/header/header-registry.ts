/**
 * The single header registry: the one place that maps each JOSE protected header
 * parameter to its aegis DOMAIN name, its spelling on EVERY wire, how its value
 * is shaped, and where it comes from.
 *
 * It is the header-side twin of `internal/claims/claims-registry.ts` and shares
 * the {@link ParamSpec} base with it (`internal/registry/`) — a header parameter
 * and a claim are the same kind of thing, and used to be described by two
 * unrelated types.
 *
 * `token-header.ts` (the header translator, mirroring `claims/translate.ts`) is
 * DATA-DRIVEN: it iterates the actual header data (domain-keyed options on
 * write, wire-keyed decoded claims on read) and looks each key up in the
 * registry. The drift-guard test binds the domain names to `DomainTokenHeader`
 * and the JOSE names to `WireTokenHeader`, so a rename on either side fails the
 * build instead of silently drifting. `internal/cose/*` resolves its integer
 * labels from here via `coseByJose`.
 *
 * --- `absent` is a STATED fact ---
 *
 * Twelve of the twenty-one parameters have no COSE form. That used to be spelled
 * as a missing `cose?: number`, indistinguishable from an oversight, with the
 * reason (where there was one) in a comment. Each now carries a required
 * `reason` on its `absent` wire key, which `coseByJose` reports when it refuses.
 *
 * --- Columns that are currently CONSTANT ---
 *
 * `direction`, `matchable`, `sensitivity` and `critical` are the same for all
 * twenty-one entries. That is an honest reading of the code, not an omission:
 * every registered parameter flows through the codec in BOTH directions (the
 * registry has carried no per-entry direction flag since the translator became
 * data-driven); there is no header MATCHER door at all, so nothing is assertable;
 * a header parameter is never encrypted content, so nothing is sensitive; and
 * aegis implements no crit extension, so nothing is critical. They are declared
 * per entry anyway, so the first parameter that breaks one of those patterns has
 * to say so here.
 */

import { isNumber } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import type { HeaderSpec } from "../registry/header-spec.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
import type { Directions, Registry } from "../registry/param-spec.js";
import {
  wireAbsent,
  wireKeyLabel,
  wireKeyName,
  wireLabel,
  wireName,
} from "../registry/wire-key.js";

export type {
  HeaderCodec,
  HeaderPlacement,
  HeaderSpec,
} from "../registry/header-spec.js";

/** Every header parameter flows in both directions — see the docstring. */
const BOTH: Directions = ["mint", "verify"];

/**
 * The registry. Ordered alphabetically by JOSE name for readability only — the
 * codec reads neither position nor any direction-scoped subset. Lookups are
 * derived from the Maps below.
 *
 * RFC references: RFC 7515 §4.1 (JWS), RFC 7516 §4.1 (JWE), RFC 7518 §4.6
 * (ECDH-ES), RFC 9052 §3.1 Table 2 (core COSE labels), RFC 9360 (X.509 COSE
 * labels), RFC 9596 (COSE `typ`), plus the lindorm-proprietary `oid`.
 */
export const HEADER_SPECS: ReadonlyArray<HeaderSpec> = [
  {
    domain: "algorithm",
    wire: { jose: wireName("alg"), cose: wireLabel(1, "alg") },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "ES256",
    placement: "protected",
    critical: false,
  },
  // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url).
  {
    domain: "partyProducer",
    wire: {
      jose: wireName("apu"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: COSE encryption is COSE_Encrypt0 with direct encryption, so no Concat-KDF party info is ever produced.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "cGFydHktdQ",
    placement: "protected",
    critical: false,
  },
  // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url).
  {
    domain: "partyRecipient",
    wire: {
      jose: wireName("apv"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: COSE encryption is COSE_Encrypt0 with direct encryption, so no Concat-KDF party info is ever produced.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "cGFydHktdg",
    placement: "protected",
    critical: false,
  },
  {
    domain: "critical",
    wire: { jose: wireName("crit"), cose: wireLabel(2, "crit") },
    codec: { kind: "critical" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    // ⚠ DOMAIN spelling. The `critical` column holds DOMAIN names like every
    // other domain-keyed value here, and `criticalToWire` maps each member
    // domain -> wire (`objectId` -> `oid`) while passing an unrecognised member
    // through unchanged. The sample was `["oid"]` — the WIRE spelling — which
    // therefore survived the write by falling through the passthrough arm and
    // came back from the read as `["objectId"]`, so the one value the column
    // exists to demonstrate did not round-trip to itself.
    sample: ["objectId"],
    placement: "protected",
    critical: false,
  },
  {
    domain: "contentType",
    wire: { jose: wireName("cty"), cose: wireLabel(3, "cty") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "application/json",
    placement: "protected",
    critical: false,
  },
  {
    domain: "encryption",
    wire: {
      jose: wireName("enc"),
      cose: wireAbsent(
        "COSE_Encrypt0 carries the content-encryption algorithm in `alg` (label 1) — there is no separate `enc` parameter to relabel.",
      ),
    },
    codec: { kind: "string" },
    // `JweKit.ts` writes it from the kit's own `this.encryption`, never from the
    // caller's bag — the column said `caller` and the code has never agreed.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "A256GCM",
    placement: "protected",
    critical: false,
  },
  {
    domain: "publicEncryptionJwk",
    wire: {
      jose: wireName("epk"),
      cose: wireAbsent(
        "The ephemeral public key is an ECDH-ES key-management output; aegis's COSE encryption is direct, so no ephemeral key is produced.",
      ),
    },
    codec: { kind: "jwk" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    placement: "protected",
    critical: false,
  },
  {
    domain: "initialisationVector",
    wire: { jose: wireName("iv"), cose: wireLabel(5, "iv") },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(12),
    // JOSE carries it on the protected header; COSE_Encrypt0 puts it in the
    // unprotected bucket (it is an AEAD input, not integrity-protected data).
    placement: "either",
    critical: false,
  },
  {
    domain: "jwksUri",
    wire: {
      jose: wireName("jku"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded key SOURCE on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "url" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/.well-known/jwks.json",
    placement: "protected",
    critical: false,
  },
  {
    domain: "jwk",
    wire: {
      jose: wireName("jwk"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded KEY on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "jwk" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    placement: "protected",
    critical: false,
  },
  {
    domain: "keyId",
    wire: { jose: wireName("kid"), cose: wireLabel(4, "kid") },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "key_sample",
    // COSE convention: kid is an advisory routing hint read BEFORE the signature
    // is checked, so the COSE kits emit it unprotected; JOSE has one header.
    placement: "either",
    critical: false,
  },
  // `oid` (lindorm object id) has no IANA COSE label, so it rides COSE under a
  // lindorm PRIVATE-USE header-parameter label — RFC 8152 §16.2, the registry
  // RFC 9052 §11.1 re-points: "Integer values less than -65536 are marked as
  // private use." Chosen well clear of the private-use CLAIM/enc label band
  // (-65537…) so a grep never confuses a header label with a claim/enc label.
  //
  // ⚠ A private-use label is UNINTERPRETABLE to a foreign reader, so it is only
  // written as an integer when the caller asks for the proprietary spelling; the
  // interoperable default emits the string label `"oid"` instead. That choice is
  // `coseWireKey` below, gated on the RANGE and never on this name.
  {
    domain: "objectId",
    wire: { jose: wireName("oid"), cose: wireLabel(-70000, "oid") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "oid_sample",
    placement: "protected",
    critical: false,
  },
  {
    domain: "pbkdfIterations",
    wire: {
      jose: wireName("p2c"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; aegis's COSE encryption is direct, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "number" },
    // The PBES2 iteration count `JweKit.ts` reads back off the key-management
    // output, beside the `p2s` salt that has always been declared `computed`.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: 310000,
    placement: "protected",
    critical: false,
  },
  {
    domain: "pbkdfSalt",
    wire: {
      jose: wireName("p2s"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; aegis's COSE encryption is direct, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(16),
    placement: "protected",
    critical: false,
  },
  {
    domain: "publicEncryptionTag",
    wire: {
      jose: wireName("tag"),
      cose: wireAbsent(
        "The key-wrap authentication tag is an AES-GCM-KW key-management output; aegis's COSE encryption is direct, so no key is wrapped.",
      ),
    },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(16),
    placement: "protected",
    critical: false,
  },
  {
    domain: "headerType",
    wire: { jose: wireName("typ"), cose: wireLabel(16, "typ") }, // RFC 9596
    codec: { kind: "string" },
    // Every kit builds the full media type itself from the `tokenType` PREFIX
    // (`buildMediaType`/`computeTypHeader`). A caller supplies the prefix, never
    // the parameter — which is why every row reserves it.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    // The FULL media type. RFC 7519 §5.1 permits the `application/` prefix to be
    // omitted on the wire, but the DOMAIN column reports what aegis reads back —
    // and aegis always writes and reports the complete media type — so the bare
    // `"at+jwt"` this held could never round-trip to itself.
    sample: "application/at+jwt",
    placement: "protected",
    critical: false,
  },
  {
    domain: "certificateChain",
    wire: { jose: wireName("x5c"), cose: wireLabel(33, "x5c") }, // RFC 9360 x5chain
    codec: { kind: "array" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: ["MIIBsample"],
    placement: "protected",
    critical: false,
  },
  // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url). Kit-derived
  // from the signing/encrypting kryptos (like `x5t#S256`), auto-emitted whenever a
  // cert is bound; the write side gates it behind a boolean, the read side never
  // verifies it.
  {
    domain: "certificateThumbprintSha1",
    wire: {
      jose: wireName("x5t"),
      cose: wireAbsent(
        "COSE's x5t (label 34, RFC 9360) is a COSE_CertHash structure `[algId, hashValue]`, NOT a plain relabel of JOSE's base64url thumbprint. Leaving it unmapped means a foreign COSE token's x5t is SKIPPED on decode rather than silently mis-shaped into a bogus string.",
      ),
    },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEx",
    placement: "protected",
    critical: false,
  },
  {
    domain: "certificateThumbprint",
    wire: {
      jose: wireName("x5t#S256"),
      cose: wireAbsent(
        "COSE's x5t (label 34, RFC 9360) is a COSE_CertHash structure `[algId, hashValue]`, NOT a plain relabel of JOSE's base64url thumbprint; the hash algorithm is a member of the structure rather than part of the parameter name.",
      ),
    },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEyNTY",
    placement: "protected",
    critical: false,
  },
  // RFC 7515 §4.1.5 — X.509 URL. COSE label 35 (RFC 9360 x5u).
  {
    domain: "certificateUrl",
    wire: { jose: wireName("x5u"), cose: wireLabel(35, "x5u") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/certs.pem",
    placement: "protected",
    critical: false,
  },
  // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value).
  {
    domain: "zip",
    wire: {
      jose: wireName("zip"),
      cose: wireAbsent(
        "COSE registers no compression header parameter, and aegis compresses nothing on the COSE wire.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "DEF",
    placement: "protected",
    critical: false,
  },
];

/**
 * The header registry. `unregistered: "drop"` states ONCE what makes the header
 * side different from the claim side: headers are a CLOSED set, so a key with no
 * entry is dropped in BOTH directions (`token-header.ts`) rather than carried
 * through as a custom parameter.
 */
export const HEADER_REGISTRY: Registry<HeaderSpec> = {
  specs: HEADER_SPECS,
  unregistered: "drop",
};

/** The JOSE wire name. Every header parameter rides JOSE, so it is always defined. */
export const headerJoseName = (spec: HeaderSpec): string => {
  const name = wireKeyName(spec.wire.jose);

  if (name === undefined) {
    throw new Error(`Header parameter "${spec.domain}" has no jose wire name`);
  }

  return name;
};

/** The COSE integer label, or `undefined` where COSE does not carry the parameter. */
export const headerCoseLabel = (spec: HeaderSpec): number | undefined =>
  wireKeyLabel(spec.wire.cose);

const byJose = new Map<string, HeaderSpec>(
  HEADER_SPECS.map((spec) => [headerJoseName(spec), spec]),
);
const byDomain = new Map<string, HeaderSpec>(
  HEADER_SPECS.map((spec) => [spec.domain, spec]),
);
// Integer COSE label -> spec. Only entries carrying a label are keyed; parameters
// COSE has no plain integer label for are absent.
const byCose = new Map<number, HeaderSpec>(
  HEADER_SPECS.flatMap((spec) => {
    const label = headerCoseLabel(spec);
    return label === undefined ? [] : [[label, spec] as const];
  }),
);
/**
 * COSE TEXT label -> spec, and deliberately NOT one entry per parameter: only the
 * parameters that can legitimately BE string-keyed on the COSE wire are here —
 * a `name`-keyed one (none today), and a PRIVATE-USE label, whose string spelling
 * is what the interoperable default emits.
 *
 * ⚠ The same {@link isPrivateUseLabel} the write side gates on, which is what
 * keeps the two spellings a single fact. A blanket "any label may also arrive as
 * its name" would let a foreign token deliver `typ` or `cty` under a text label
 * aegis never writes, i.e. a second spelling for a registered parameter that no
 * specification gives it.
 */
const byCoseName = new Map<string, HeaderSpec>(
  HEADER_SPECS.flatMap((spec) => {
    const key = spec.wire.cose;

    if (key.kind === "absent") return [];
    if (key.kind === "label" && !isPrivateUseLabel(key.label)) return [];

    return [[key.name, spec] as const];
  }),
);

/** Resolve a header spec by its JOSE wire name (or `undefined` if unregistered). */
export const headerByJose = (jose: string): HeaderSpec | undefined => byJose.get(jose);

/** Resolve a header spec by its domain name (or `undefined` if unregistered). */
export const headerByDomain = (domain: string): HeaderSpec | undefined =>
  byDomain.get(domain);

/** Resolve a header spec by its integer COSE label (or `undefined` if none). */
export const headerByCose = (label: number): HeaderSpec | undefined => byCose.get(label);

/**
 * The JOSE wire name for a COSE label, or `undefined` if COSE carries no
 * registered parameter under it. The COSE read paths translate labels back to
 * JOSE names, which is the vocabulary the domain layer speaks.
 *
 * ⚠ It takes a {@link CoseLabel}, not an integer, because RFC 9052 §1.5 makes a
 * text label a label too — and the interoperable default WRITES one for every
 * private-use parameter. A token minted either way must therefore read back to
 * the same domain header, so this is the READ half of `coseWireKey`: an integer
 * resolves through the label table, a string through the text-label table, and
 * neither table answers for the other.
 */
export const joseByCose = (label: CoseLabel): string | undefined => {
  const spec = isNumber(label) ? byCose.get(label) : byCoseName.get(label);

  return spec ? headerJoseName(spec) : undefined;
};

/** The refusal both COSE resolvers give for a parameter COSE does not carry. */
const noCoseLabel = (jose: string, spec: HeaderSpec | undefined): CoseError =>
  new CoseError("No COSE label for header parameter", {
    code: "header_no_cose_label",
    data: {
      jose,
      reason: spec?.wire.cose.kind === "absent" ? spec.wire.cose.reason : undefined,
    },
    title: "No COSE Label For Header Parameter",
    details:
      "The header registry has no COSE integer label for this JOSE wire parameter; COSE either omits it or represents it with a non-integer structure.",
  });

/**
 * The COSE INTEGER header label for a JOSE wire parameter. THROWS if COSE does
 * not carry the parameter, reporting the registry's stated `reason`, which is the
 * drift guard against a caller asking for a label that does not exist.
 *
 * ⚠ NOT the writer's resolver — that is {@link coseWireKey}. This answers the
 * narrower question "which integer is this parameter registered at", which is
 * what the READ paths need to look a decoded label up (`CweKit`'s `iv`,
 * `decode-cwt`'s `kid`/`alg`/`typ`) and what the derived-parameter tables are
 * keyed by. A writer that reaches for it instead would put a private-use integer
 * on an interoperable wire.
 */
export const coseByJose = (jose: string): number => {
  const spec = byJose.get(jose);
  const label = spec ? headerCoseLabel(spec) : undefined;

  if (label === undefined) throw noCoseLabel(jose, spec);

  return label;
};

/**
 * THE WRITER'S RESOLVER: the COSE label a parameter is spelled by on the wire,
 * in the interop mode the caller asked for. Every COSE write path resolves
 * through this and nothing else, so a parameter, a `crit` member naming it and
 * the reserved-parameter guard all agree on one spelling.
 *
 * RFC 9052 §1.5 defines `label = int / tstr`, so a text label is a label — which
 * is what makes the interoperable answer possible at all:
 *
 *   - a REGISTERED integer label is interoperable as it stands, so it is written
 *     as the integer in both modes;
 *   - a PRIVATE-USE integer label ({@link isPrivateUseLabel}) means nothing to a
 *     foreign reader, so `proprietary: false` — the default — writes the
 *     parameter's string label instead. Nothing is dropped and nothing is
 *     renamed; only the encoding of the key changes.
 *   - `proprietary: true` is the on-platform token: the compact private-use
 *     integer, which is the shorter encoding and the one aegis reads either way.
 *
 * That is the header twin of the promise `EncodeCwtOptions` already kept for
 * claims — a token minted with the default carries nothing a conformant COSE
 * reader cannot interpret.
 *
 * THROWS for a parameter COSE does not carry, exactly as {@link coseByJose} does
 * and with the same verdict: a caller naming one must hear so.
 */
export const coseWireKey = (
  jose: string,
  proprietary: boolean | undefined,
): CoseLabel => {
  const spec = byJose.get(jose);

  if (spec === undefined) throw noCoseLabel(jose, spec);

  const key = spec.wire.cose;

  switch (key.kind) {
    case "absent":
      throw noCoseLabel(jose, spec);
    // A parameter COSE keys by its NAME is already the string on every wire; the
    // interop mode has nothing to choose. None today — the registry's `name` cells
    // are all interop fallbacks for a label — but `WireKey` declares the case, so
    // the resolver answers it rather than casting it away.
    case "name":
      return key.name;
    case "label":
      return proprietary === true || !isPrivateUseLabel(key.label) ? key.label : key.name;
    default: {
      // `noImplicitReturns` is off repo-wide: without this a new `WireKey` member
      // would silently resolve to `undefined` and the parameter would be written
      // under an undefined label rather than failing the build.
      const exhaustive: never = key;
      throw new CoseError("Unhandled COSE wire key kind", {
        code: "header_unhandled_wire_key_kind",
        data: { jose, kind: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled COSE Wire Key Kind",
        details:
          "The header registry declares a COSE wire key kind the resolver does not handle, so the parameter has no spelling on the COSE wire.",
      });
    }
  }
};

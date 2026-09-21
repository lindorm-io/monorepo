import type { Wire } from "../internal/registry/wire.js";

/**
 * THE PER-SPEC DISPOSITION TABLES — the consumer `ParamSpec.sample` never had.
 *
 * `sample` is REQUIRED on all 99 registry entries (78 claims, 21 header
 * parameters) and its whole stated purpose is to stop a new parameter being
 * added without giving the conformance suite something to round-trip. Nothing
 * read it. A required column with no reader is a column that documents an
 * intention, and the parameters it was meant to cover were free to be added,
 * mis-shaped or dropped without a single test noticing — which is how a sample
 * that is not a member of its own union, and a sample two years ahead of any
 * clock that could verify it, both sat in the registry unread.
 *
 * Every entry here states ONE of three dispositions for its parameter, and the
 * matrix RUNS it:
 *
 *  - `roundTrip`     a caller can supply this parameter through a named public
 *                    door. The matrix supplies the `sample`, reads the artifact
 *                    back and requires the value to return under its DOMAIN name
 *                    in its domain shape. The door is named, so "how does a
 *                    caller set this?" has an answer that is executed rather
 *                    than remembered.
 *  - `refused`       the parameter has no representation on that wire, and a
 *                    mint handed it must REFUSE rather than drop it. The matrix
 *                    requires the throw.
 *  - `notSuppliable` there is no caller door at all — aegis derives the value
 *                    from the key, the clock or the deployment identity. The
 *                    matrix asserts what CAN be asserted — that the parameter
 *                    appears on the wire when the operation that produces it
 *                    runs — or, where even that is unreachable, the entry says
 *                    plainly that nothing is assertable and why.
 *
 * ⚠ `refused` and `notSuppliable` ARE NOT ESCAPE HATCHES. A parameter a caller
 * CAN supply and that does NOT come back is neither: it is a `defect`, which
 * carries a `file:line` and skips the wire it names, and the matrix RUNS every
 * declared defect and requires it to FAIL FOR THE REASON IT NAMES — otherwise
 * the field is a way of turning a red cell green by writing a sentence.
 *
 * ⚠ "For the reason it names" is the whole of it. A bare "it did not round-trip"
 * check is satisfied by ANY thrown message — including the interpreter's own
 * "declares a roundTrip with no door", which sits one line above the door call —
 * so `run-spec-disposition.ts` tags every way a cell can fail, and only the tags
 * naming a SHORTFALL count as proof.
 */

/**
 * The named public doors. Each is implemented ONCE in
 * `run-spec-disposition.ts`; a table entry names one and carries no behaviour,
 * exactly as a knob probe does.
 */
export type SpecDoor =
  /** `mint("default", { subject, expires, [domain]: sample })` -> `verify().claims`. */
  | "mint.content"
  /** `mint("userinfo", { …, profile: { [domain]: sample } })` -> `verify().profile`. */
  | "mint.profile"
  /** `mint("userinfo", { …, claims: { [domain]: sample } })` -> `verify().sensitive`. */
  | "mint.sensitive"
  /** `mint("default", …, { sign: { [domain]: sample } })` -> `verify().claims`. */
  | "mint.sign"
  /** `mint("default", { …, expires: sample })` -> `verify().claims.expiresAt`. */
  | "mint.expires"
  /** `mint("delegation", { issuer: sample, … })` -> `verify().claims.issuer`. */
  | "mint.issuer"
  /** `mint("default", …, { sign: { header: { [domain]: sample } } })` -> `parse().header`. */
  | "mint.header"
  /** `mint("default", …, { sign: { typ: sample } })` -> `parse().header.headerType`. */
  | "mint.typ"
  /** `jwe.encrypt(data, { [domain]: sample })` -> `decrypt().header`. */
  | "encrypt.party";

/**
 * How a `notSuppliable` parameter is OBSERVED — the operation that produces it,
 * run so the parameter's presence can be asserted even though no caller can set
 * it. `"none"` is the honest answer where no fixture can reach the producing
 * path at all, and it obliges the entry to say why.
 */
export type SpecObservation =
  /** Any signed token carries it. */
  | "sign"
  /** Any minted token's claim layer carries it. */
  | "claims"
  /** A JWE/CWE carries it. */
  | "encrypt"
  /** A JWE to an ECDH-ES recipient carries it. */
  | "encrypt.ecdh"
  /** A token minted with a certificate binding carries it. */
  | "certificate"
  /** Nothing this suite can build reaches it — the entry states why. */
  | "none";

export type SpecDisposition = {
  disposition: "roundTrip" | "refused" | "notSuppliable";
  /** Required for `roundTrip` and `refused`: the door the matrix opens. */
  door?: SpecDoor;
  /** Required for `notSuppliable`: how presence is observed, or `"none"`. */
  observe?: SpecObservation;
  /**
   * Required for `refused` and `notSuppliable`: WHY, cited to the primary text
   * where the reason is a specification fact.
   */
  reason?: string;
  /**
   * The value a `roundTrip` must come back as, where the wire RE-SPELLS the
   * registry's own {@link ParamSpec.sample}. Defaults to that sample, which is
   * what every parameter both wires spell identically wants.
   *
   * ⚠ A re-spelling is NOT a shortfall, so it is not a {@link defect}: the
   * parameter IS suppliable and DOES come back, under its domain name, in the
   * spelling that wire registers for it. The one instance is the type header —
   * `application/at+jwt` on JOSE, `application/at+cwt` on COSE (RFC 9596 §2).
   *
   * ⛔ A LITERAL, never derived from the code under test. Computing it from the
   * translator would put the same expression on both sides of the comparison, and
   * the cell would agree with a wrong translation as readily as a right one.
   */
  sample?: unknown;
  /** A DIFFERENT disposition on one wire, with its own reason. */
  per?: Partial<Record<Wire, Omit<SpecDisposition, "per">>>;
  /**
   * TRANSIENT. The parameter IS suppliable and does NOT come back — a code
   * shortfall, not a specification one. Carries `file#anchor` — the anchor a
   * VERBATIM substring of the cited line, so the meta suite resolves it instead
   * of trusting a line number code motion silently invalidates — skips the wires
   * it names, and is RUN by the matrix and required to still fail.
   */
  defect?: { site: string; note: string; wires: ReadonlyArray<Wire> };
};

const CALLER: SpecDisposition = { disposition: "roundTrip", door: "mint.content" };
const PROFILE: SpecDisposition = { disposition: "roundTrip", door: "mint.profile" };
const SENSITIVE: SpecDisposition = { disposition: "roundTrip", door: "mint.sensitive" };
const SIGN_OPTION: SpecDisposition = { disposition: "roundTrip", door: "mint.sign" };

/**
 * The COSE reason shared by every JOSE key-management parameter: aegis wraps no
 * key, agrees no ephemeral key and stretches no password on that wire, so there
 * is no key-management output to carry and no label to carry it under.
 * RFC 9052 §5.2.
 */
const NO_COSE_KEY_MANAGEMENT =
  "A COSE_Encrypt0 carries no recipients array, so aegis performs no key management on that wire and the parameter has no output to name; the registry marks it absent on COSE. RFC 9052 §5.2.";

/**
 * One entry per {@link CLAIM_SPECS} member, keyed by its DOMAIN name. The matrix
 * compares this key set to the registry's own at RUNTIME — two independently
 * authored artifacts — so a new claim has no disposition and fails there.
 */
export const CLAIM_DISPOSITIONS: Readonly<Record<string, SpecDisposition>> = {
  // --- stamped from the deployment identity ----------------------------------
  issuer: {
    disposition: "roundTrip",
    door: "mint.issuer",
  },

  // --- produced by aegis itself: the mint clock, the generated id, the hashes --
  //
  // ⚠ Only ONE of the seven is genuinely unsettable. The other six have a named
  // caller door — `options.sign` for the five scalars, `content.notBefore` for
  // the sixth — so the door is what decides the disposition, never a summary of
  // where the value usually comes from.
  //
  // ⚠ This paragraph is why the registry carries no `provenance` column. Such a
  // column answers "where does the value usually come from?"; the only question a
  // consumer asks is "is there a caller door, and which one?", and this table
  // answers that BY EXECUTION. A column contradicted by the one artifact organised
  // around it is a second source of truth, not a fact.
  expiresAt: { disposition: "roundTrip", door: "mint.expires" },
  notBefore: CALLER,
  issuedAt: SIGN_OPTION,
  tokenId: SIGN_OPTION,
  accessTokenHash: SIGN_OPTION,
  codeHash: SIGN_OPTION,
  stateHash: SIGN_OPTION,

  // --- caller-supplied, bucket "claims", public ------------------------------
  subject: CALLER,
  audience: CALLER,
  confirmation: CALLER,
  scope: CALLER,
  authContextClassReference: CALLER,
  authMethods: CALLER,
  authorizedParty: CALLER,
  vectorOfTrust: CALLER,
  vectorTrustMark: CALLER,
  act: CALLER,
  grantType: CALLER,
  sessionId: CALLER,
  transactionId: CALLER,
  levelOfAssurance: CALLER,
  authenticatorAssuranceLevel: CALLER,
  identityAssuranceLevel: CALLER,
  federationAssuranceLevel: CALLER,
  authFactorReference: CALLER,
  authFactorCategories: CALLER,
  sessionHint: CALLER,
  subjectHint: CALLER,
  nonce: CALLER,
  authTime: CALLER,
  authorizationDetails: CALLER,
  mayAct: CALLER,
  entitlements: CALLER,
  groups: CALLER,
  roles: CALLER,
  permissions: CALLER,
  clientId: CALLER,
  subjectId: CALLER,
  events: CALLER,
  tenantId: CALLER,
  conformsTo: CALLER,
  username: CALLER,

  // --- sensitivity "sensitive" -----------------------------------------------
  //
  // Supplied through the GENERAL claims bag on an encryptable profile, which is
  // the route that matters: the confidentiality gate keys off the registry's
  // category and not off which container the caller chose, so a sensitive claim
  // routed through the general bag must still force an encrypted token and come
  // back in the `sensitive` bucket.
  nationalIdentityNumber: SENSITIVE,
  nationalIdentityNumberVerified: SENSITIVE,
  socialSecurityNumber: SENSITIVE,
  socialSecurityNumberVerified: SENSITIVE,

  // --- bucket "profile" ------------------------------------------------------
  address: PROFILE,
  email: PROFILE,
  emailVerified: PROFILE,
  phoneNumber: PROFILE,
  phoneNumberVerified: PROFILE,
  picture: PROFILE,
  birthdate: PROFILE,
  familyName: PROFILE,
  gender: PROFILE,
  givenName: PROFILE,
  locale: PROFILE,
  middleName: PROFILE,
  name: PROFILE,
  nickname: PROFILE,
  preferredUsername: PROFILE,
  profile: PROFILE,
  updatedAt: PROFILE,
  website: PROFILE,
  zoneinfo: PROFILE,
  displayName: PROFILE,
  honorific: PROFILE,
  legalName: PROFILE,
  legalNameVerified: PROFILE,
  namingSystem: PROFILE,
  preferredAccessibility: PROFILE,
  preferredName: PROFILE,
  pronouns: PROFILE,
  department: PROFILE,
  jobTitle: PROFILE,
  occupation: PROFILE,
  organization: PROFILE,
};

/**
 * One entry per {@link HEADER_SPECS} member, keyed by its DOMAIN name. Same
 * runtime key-set binding as the claim table.
 *
 * The caller-settable set is SEVEN of the twenty-one, and it is not a judgement
 * — `DomainProtectedHeader` is `Omit<DomainTokenHeader, KitOwnedDomainParam>`,
 * so the fourteen the kit derives are unreachable by construction. Every one of
 * those fourteen is therefore `notSuppliable`, and the question each entry has to
 * answer is whether its presence can be OBSERVED.
 */
export const HEADER_DISPOSITIONS: Readonly<Record<string, SpecDisposition>> = {
  // --- caller-settable through the domain header bag -------------------------
  contentType: { disposition: "roundTrip", door: "mint.header" },
  objectId: { disposition: "roundTrip", door: "mint.header" },
  certificateUrl: { disposition: "roundTrip", door: "mint.header" },
  critical: { disposition: "roundTrip", door: "mint.header" },

  jwk: {
    disposition: "roundTrip",
    door: "mint.header",
    per: {
      cose: {
        disposition: "refused",
        door: "mint.header",
        reason:
          "aegis maps no COSE header parameter for an embedded key, so `coseByJose` has no label to write it under and refuses with `header_no_cose_label` rather than dropping it. RFC 9052 §3.1.",
      },
    },
  },

  jwksUri: {
    disposition: "roundTrip",
    door: "mint.header",
    per: {
      cose: {
        disposition: "refused",
        door: "mint.header",
        reason:
          "aegis maps no COSE header parameter for a key SOURCE, so `coseByJose` refuses with `header_no_cose_label`. RFC 9052 §3.1.",
      },
    },
  },

  zip: {
    disposition: "roundTrip",
    door: "mint.header",
    per: {
      cose: {
        disposition: "refused",
        door: "mint.header",
        reason:
          "aegis maps no COSE header parameter for compression, so the registry marks it absent and `coseByJose` refuses it. RFC 9052 §3.1.",
      },
    },
  },

  // --- kit-derived, with a DEDICATED option ----------------------------------
  headerType: {
    disposition: "roundTrip",
    door: "mint.typ",
    per: {
      // The SAME media type in the COSE spelling: the structured suffix is the
      // wire's own, and the kits re-wrap the bare prefix a mint derives. Written
      // out rather than translated here, per the `sample` note above.
      // RFC 9596 §2, RFC 8392 §9.2.
      cose: { disposition: "roundTrip", door: "mint.typ", sample: "application/at+cwt" },
    },
  },

  // ⚠ NOT a caller door. `bindCertificate` is a MODE — "chain" / "thumbprint" /
  // "none" — and the VALUE is derived from the key's own certificate. A
  // disposition of `roundTrip` here would be
  // asserting that a caller-supplied chain comes back, and no caller can supply
  // one: the sample `["MIIBsample"]` is a representative shape, never a value the
  // surface accepts. What IS assertable is that the binding appears when the mode
  // asks for it, which is what the observation runs — on BOTH wires, since
  // every COSE writer derives it too, at label 33 (RFC 9360 §2).
  certificateChain: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate chain: a caller-stated `x5c` would be a chain that does not belong to the signature it accompanies. RFC 7515 §4.1.6.",
  },
  certificateThumbprint: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate: `x5t#S256` is a digest of the signing key's certificate, not a caller value. RFC 7515 §4.1.8.",
  },
  certificateThumbprintSha1: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate: `x5t` is a SHA-1 digest of the signing key's certificate, not a caller value. RFC 7515 §4.1.7.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "COSE has ONE thumbprint parameter, `x5t` at label 34, whose value is a COSE_CertHash `[ hashAlg, hashValue ]` — the digest algorithm is a member of the value rather than the difference between two parameter names. There is no SHA-1-NAMED parameter for aegis to emit, so no COSE path produces one to observe. (A foreign token's SHA-1 COSE_CertHash DOES read back onto this domain field, through label 34's hashAlg dispatch; what is unobservable here is a write.) RFC 9360 §2.",
      },
    },
  },

  partyProducer: {
    disposition: "roundTrip",
    door: "encrypt.party",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
  partyRecipient: {
    disposition: "roundTrip",
    door: "encrypt.party",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },

  // --- kit-derived, no caller door at all ------------------------------------
  algorithm: {
    disposition: "notSuppliable",
    observe: "sign",
    reason:
      "Derived from the signing key: a value a caller could state independently of the key would be a header that disagrees with the signature it describes. RFC 7515 §4.1.1, RFC 9052 §3.1.",
  },
  keyId: {
    disposition: "notSuppliable",
    observe: "sign",
    reason:
      "Derived from the resolved key: `kid` is the key's own identity, not something a caller supplies alongside it. RFC 7515 §4.1.4.",
  },
  encryption: {
    disposition: "notSuppliable",
    observe: "encrypt",
    reason:
      "Taken from the recipient key, or the deployment's default encryption — `enc` states the content encryption actually applied rather than what was asked for. RFC 7516 §4.1.2.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "A COSE_Encrypt0 written by aegis carries the content-encryption algorithm in `alg` (label 1), so there is no separate `enc` parameter to observe. RFC 9052 §3.1, RFC 9052 §5.2.",
      },
    },
  },
  initialisationVector: {
    disposition: "notSuppliable",
    observe: "none",
    reason:
      "Produced by the AEAD, and on JOSE it is not a header parameter at all — the Initialization Vector is its own SEGMENT of the compact serialisation, and the `iv` HEADER parameter belongs to AES-GCM key wrapping, for which aegis holds no fixture recipient key. So there is no JOSE artifact this suite can build that carries the parameter. RFC 7516 §7.1, RFC 7518 §4.7.1.1.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "encrypt",
        reason:
          "COSE_Encrypt0 carries the IV as header parameter label 5 (RFC 9052 §3.1), in the UNPROTECTED bucket, so it IS observable on that wire — through the kit door, which reports both buckets.",
      },
    },
  },
  publicEncryptionJwk: {
    disposition: "notSuppliable",
    observe: "encrypt.ecdh",
    reason:
      "The ephemeral public key of the agreement — it exists only because aegis generated it. RFC 7518 §4.6.1.1.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
  publicEncryptionTag: {
    disposition: "notSuppliable",
    observe: "none",
    reason:
      "The AES-GCM key-wrap authentication tag (RFC 7518 §4.7.1.2). aegis's fixtures hold no GCMKW recipient key, so no token this suite can build carries one; the parameter is observable only on a deployment that wraps its content key.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
  pbkdfSalt: {
    disposition: "notSuppliable",
    observe: "none",
    reason:
      "PBES2 salt input (RFC 7518 §4.8.1.1). aegis holds no password-based recipient key, so no token this suite can build carries one.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
  pbkdfIterations: {
    disposition: "notSuppliable",
    observe: "none",
    reason:
      "PBES2 iteration count (RFC 7518 §4.8.1.2). Same absent recipient key as `pbkdfSalt`.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
};

import type { Wire } from "./scenarios.js";

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
 * ⚠ "For the reason it names" is the whole of it, and this comment used to claim
 * it while the check underneath was a bare "it did not round-trip" that ANY
 * thrown message satisfied — including the interpreter's own "declares a
 * roundTrip with no door", which sits one line above the door call. That is the
 * coarse binary the knob matrix's tags were introduced to replace, so the same
 * discipline applies here: `run-spec-disposition.ts` tags every way a cell can
 * fail, and only the tags naming a SHORTFALL count as proof.
 */

/**
 * The named public doors. Each is implemented ONCE in
 * `run-spec-disposition.ts`; a table entry names one and carries no behaviour,
 * exactly as a scenario row does.
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
 * The COSE reason shared by every JOSE key-management parameter. RFC 9052 §5.2:
 * "The COSE_Encrypt0 encrypted structure does not have the ability to specify
 * recipients of the message. The structure assumes that the recipient of the
 * object will already know the identity of the key to be used in order to decrypt
 * the message." So no key is wrapped, no ephemeral key is agreed and no password
 * is stretched — there is no key-management output to carry and no label to carry
 * it under.
 */
const NO_COSE_KEY_MANAGEMENT =
  "COSE_Encrypt0 specifies no recipients and assumes the recipient already knows the decryption key (RFC 9052 §5.2), so aegis performs no key management on that wire and the parameter has no output to name; the registry marks it absent on COSE.";

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
  // ⚠ This paragraph is why the registry's `provenance` column is GONE. The
  // column answered "where does the value usually come from?"; the only question
  // a consumer asks is "is there a caller door, and which one?", and this table
  // already answered it BY EXECUTION while explicitly refusing to derive from the
  // column. A column contradicted by the one artifact organised around it is a
  // second source of truth, not a fact.
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
          "aegis maps no COSE header parameter for an embedded key, so `coseByJose` has no label to write it under and refuses with `header_no_cose_label` rather than dropping it. RFC 9052 §3.1 defines the COSE common header parameters and registers no embedded-key parameter among them.",
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
          "aegis maps no COSE header parameter for a key SOURCE, so `coseByJose` refuses with `header_no_cose_label`. RFC 9052 §3.1's common header parameters contain no key-set URI.",
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
          "COSE registers no compression header parameter — RFC 9052 §3.1 defines the common header parameters and none of them names a compression algorithm — so the registry marks it absent and `coseByJose` refuses it.",
      },
    },
  },

  // --- kit-derived, with a DEDICATED option ----------------------------------
  headerType: {
    disposition: "roundTrip",
    door: "mint.typ",
    defect: {
      site: "src/internal/wire/cose-token-wire.ts#mintTypPrefix:",
      note: "`SignTokenOptions.typ` is honoured on JOSE and SILENTLY DROPPED on COSE: `mintTypPrefix` there reads the profile and nothing else, so a caller `typ` for a `cwt`/`cwm` mint is accepted by the type, ignored by the writer, and the token carries the profile's media type instead. The COSE kits RESERVE `typ` — a caller value in the kit-tier header bag is refused — so the same option is refused at one door and silently dropped at another. The gap is recorded in the source comment above that line; this is the runnable proof it is still there.",
      wires: ["cose"],
    },
  },

  // ⚠ NOT a caller door. `bindCertificate` is a MODE — "chain" / "thumbprint" /
  // "none" — and the VALUE is derived from the key's own certificate. A
  // disposition of `roundTrip` here would be
  // asserting that a caller-supplied chain comes back, and no caller can supply
  // one: the sample `["MIIBsample"]` is a representative shape, never a value the
  // surface accepts. What IS assertable is that the binding appears when the mode
  // asks for it, which is what the observation runs.
  certificateChain: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate chain. RFC 7515 §4.1.6 makes `x5c` the X.509 certificate chain CORRESPONDING TO THE KEY used to digitally sign the JWS, so a caller-stated chain would be a chain that does not belong to the signature it accompanies.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "`resolveCertBinding` has no COSE caller — `KIT_CAPABILITIES.<cose>.certificateBinding` is `false` for every COSE row — so no COSE path produces a certificate binding to observe. The accept-and-ignore above it is recorded as a capability the COSE kits do not have.",
      },
    },
  },
  certificateThumbprint: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate. RFC 7515 §4.1.8 makes `x5t#S256` the base64url-encoded SHA-256 thumbprint of the DER encoding of the certificate corresponding to the signing key, so it is a digest of the key material and not a caller value.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "COSE's `x5t` (label 34, RFC 9360 §2) is a COSE_CertHash — the two-element structure `[ hashAlg, hashValue ]` — not a relabelling of the JOSE base64url thumbprint, whose hash algorithm is part of the parameter NAME. The registry leaves it unmapped so a foreign token's x5t is skipped rather than mis-shaped, and no COSE path emits one to observe.",
      },
    },
  },
  certificateThumbprintSha1: {
    disposition: "notSuppliable",
    observe: "certificate",
    reason:
      "Derived from the key's own certificate. RFC 7515 §4.1.7 makes `x5t` the base64url-encoded SHA-1 thumbprint of the DER encoding of the certificate corresponding to the signing key.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "Same COSE_CertHash structure as `certificateThumbprint` (RFC 9360 §2) — the SHA-1 form is no more relabellable than the SHA-256 one, and no COSE path emits one to observe.",
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
      "Derived from the signing key. RFC 7515 §4.1.1 makes `alg` the algorithm used to secure the JWS and RFC 9052 §3.1 gives label 1 the same meaning, so a value a caller could state independently of the key would be a header that disagrees with the signature it describes.",
  },
  keyId: {
    disposition: "notSuppliable",
    observe: "sign",
    reason:
      "Derived from the resolved key. RFC 7515 §4.1.4 makes `kid` a hint identifying the key that secured the token, so it is the key's own identity and nothing a caller supplies alongside it.",
  },
  encryption: {
    disposition: "notSuppliable",
    observe: "encrypt",
    reason:
      "Taken from the recipient key, or the deployment's default encryption. RFC 7516 §4.1.2 makes `enc` the content-encryption algorithm actually applied, so it states what happened rather than what was asked for.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason:
          "COSE_Encrypt0 carries the content-encryption algorithm in `alg` (label 1) — RFC 9052 §5.2 gives direct encryption one algorithm and one label — so there is no separate `enc` parameter to observe.",
      },
    },
  },
  initialisationVector: {
    disposition: "notSuppliable",
    observe: "none",
    reason:
      "Produced by the AEAD, and on JOSE it is not a header parameter at all: RFC 7516 §7.1 makes the Initialization Vector its own SEGMENT of the compact serialisation, and the `iv` HEADER parameter belongs to AES-GCM key wrapping (RFC 7518 §4.7.1.1) — for which aegis holds no fixture recipient key. So there is no JOSE artifact this suite can build that carries the parameter.",
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
      "The ephemeral public key of the agreement. RFC 7518 §4.6.1.1 makes `epk` the ephemeral public key created by the ORIGINATOR for the agreement, so it exists only because aegis generated it.",
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
      "The AES-GCM key-wrap authentication tag (RFC 7518 §4.7.1.2 — `tag` is the authentication tag resulting from the key encryption). aegis's fixtures hold no GCMKW recipient key, so no token this suite can build carries one; the parameter is observable only on a deployment that wraps its content key.",
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
      "PBES2 key derivation input (RFC 7518 §4.8.1.1 — `p2s` is the PBES2 salt input). aegis holds no password-based recipient key, so no token this suite can build carries one.",
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
      "PBES2 key derivation input (RFC 7518 §4.8.1.2 — `p2c` is the PBES2 count). Same absent recipient key as `pbkdfSalt`.",
    per: {
      cose: {
        disposition: "notSuppliable",
        observe: "none",
        reason: NO_COSE_KEY_MANAGEMENT,
      },
    },
  },
};

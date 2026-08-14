import type { Dict } from "@lindorm/types";
import type { TokenType } from "../constants/token-type.js";
import type {
  BindCertificateMode,
  ClaimsTokenFormat,
  DomainProtectedHeader,
  OmitMode,
  SignContent,
  SignContext,
} from "../types/index.js";

/**
 * The WIRE CORPUS — one declarative row per token aegis is asked to emit.
 *
 * It exists to be FROZEN. A restructuring step is about to collapse duplicated
 * JOSE/COSE write paths, and the only way to say afterwards that nothing
 * unintended moved is to hold a byte-level record of what the wire said before.
 * `run-corpus.ts` turns this table into that record; `corpus.test.ts` proves the
 * record is reproducible.
 *
 * ⭐ THE WORKFLOW — the freeze is taken BEFORE the restructuring, never after:
 *
 * ```
 * npm run corpus -- /tmp/corpus-BEFORE.json   # on the UNCHANGED tree, first
 * …restructure…
 * npm run corpus -- /tmp/corpus-AFTER.json
 * diff -q /tmp/corpus-BEFORE.json /tmp/corpus-AFTER.json   # must be EMPTY
 * ```
 *
 * ⚠ The BEFORE half is the whole gate, and it is the half that cannot be
 * recovered later: a baseline regenerated from an already-changed tree measures
 * the change against itself and would agree with anything. If the freeze was not
 * taken first, say so — do not produce one afterwards and call it a baseline.
 *
 * ⚠ The record is deliberately NOT committed — not as a fixture, not as a
 * `.snap`. It is a throwaway measurement of ONE restructuring, taken to a path
 * outside the repo; a checked-in copy would turn every deliberate wire change
 * into a snapshot update, which is the opposite of a freeze.
 *
 * Same discipline as every other table in `__fixtures__`: rows are PURE DATA —
 * no lambdas, no `Buffer` literals, no live `Date`s — and ALL behaviour lives in
 * the runner beside it. A row states what to ask the PUBLIC `Aegis` surface for;
 * it never states what the answer should be. The corpus asserts nothing: the
 * answer IS the artifact.
 *
 * ⚠ A row must be REPRODUCIBLE, which is a stronger requirement than any other
 * table here carries. Three things would otherwise make the record worthless —
 * the clock, generated token ids, and encryption randomness. The first two are
 * closed here ({@link CORPUS_CLOCK} and a mandatory `tokenId` on every row that
 * can carry one); the third cannot be closed at all and is NORMALISED by the
 * runner instead.
 */

/**
 * The instant every corpus row is emitted at.
 *
 * It is the same instant `run-scenario.ts` pins its own `DEFAULT_CLOCK` to, and
 * it is RESTATED rather than imported: importing that module would drag the whole
 * scenario interpreter — `@auth0/cose`, `jose`, and vitest's `expect` — into a
 * file that must also run as a standalone script under `tsx`. Nothing reads both
 * constants, so the two cannot disagree about anything; they merely happen to
 * name the same moment, which makes a corpus token and a scenario token directly
 * comparable.
 */
export const CORPUS_CLOCK = "2024-01-01T08:00:00.000Z";

/**
 * The deployment issuer every corpus token is minted under, and the scope its
 * vault is keyed by.
 *
 * It MUST equal the issuer the key fixtures carry (`keys.ts`, the shared
 * `defaults`): amphora stamps every key it holds with its own issuer, and read-
 * side key selection is scoped by it, so a mismatch makes the vault look empty
 * for the corpus's own tokens. That constant is not exported, which is why this
 * one restates the string rather than importing it.
 */
export const CORPUS_ISSUER = "https://test.lindorm.io/";

/**
 * The key fixtures a row may name. The names match `keys.ts`'s exports through
 * the runner's own table; a row never holds a key, because a key is not data.
 */
export type CorpusSignKey =
  | "ec-sig"
  | "ec-sig-cert"
  | "oct-sig"
  | "okp-sig"
  | "rsa-sig"
  | "akp-sig";

export type CorpusEncKey =
  | "ec-enc"
  | "ec-enc-cert"
  | "oct-enc"
  | "oct-enc-cbc"
  | "oct-enc-gcm128"
  | "okp-enc"
  | "rsa-enc";

/**
 * A payload a row hands to an OPAQUE surface, spelled so it survives being pure
 * data. `bytes` is hex rather than base64url so a row's payload is legible as
 * bytes at a glance, which is what an opaque payload is.
 */
export type PayloadCell =
  | { kind: "object"; value: Dict }
  | { kind: "string"; value: string }
  | { kind: "bytes"; hex: string };

/** The write knobs a `mint` row may turn — every one of them changes the wire. */
export type MintKnobs = {
  /** MANDATORY. A generated token id would make the row irreproducible. */
  tokenId: string;
  bindCertificate?: BindCertificateMode;
  certificateThumbprintSha1?: boolean;
  context?: SignContext;
  header?: DomainProtectedHeader;
  lifetime?: string;
  omit?: OmitMode;
  proprietary?: boolean;
  /** The profile's mandated `typ`, overridden verbatim. `null` omits it. */
  typ?: string | null;
};

/** The write knobs an opaque `sign` row may turn. */
export type SignKnobs = {
  bindCertificate?: BindCertificateMode;
  certificateThumbprintSha1?: boolean;
  header?: DomainProtectedHeader;
  omit?: OmitMode;
  tokenType?: TokenType;
};

/** The write knobs an `encrypt` row may turn. */
export type EncryptKnobs = {
  bindCertificate?: BindCertificateMode;
  header?: DomainProtectedHeader;
  omit?: OmitMode;
  partyProducer?: string;
  partyRecipient?: string;
  proprietary?: boolean;
  type?: TokenType;
};

/**
 * A profiled mint — `aegis.mint(profile, content, options)`. `encryptKey` is the
 * sign-then-encrypt wrapper: naming one turns a signed inner into an encrypting
 * outer, and only an encryptable profile accepts it.
 */
export type MintCase = {
  verb: "mint";
  name: string;
  /** WHY this row is in the corpus — what about the wire it is here to hold. */
  note: string;
  profile: string;
  format: ClaimsTokenFormat;
  content: SignContent;
  signKey: CorpusSignKey;
  encryptKey?: CorpusEncKey;
  options: MintKnobs;
};

/** An opaque signature — `aegis.sign({ format, payload, … })`. */
export type SignCase = {
  verb: "sign";
  name: string;
  note: string;
  format: "jws" | "cws";
  payload: PayloadCell;
  signKey: CorpusSignKey;
  options?: SignKnobs;
};

/** A confidentiality-only seal — `aegis.encrypt(data, { format, … })`. */
export type EncryptCase = {
  verb: "encrypt";
  name: string;
  note: string;
  format: "jwe" | "cwe";
  data: PayloadCell;
  encryptKey: CorpusEncKey;
  options?: EncryptKnobs;
};

export type CorpusCase = MintCase | SignCase | EncryptCase;

/**
 * The claims a mint row starts from. Spelled once: what the corpus varies is the
 * WIRE, so a row that also varied its content would confuse a header diff with a
 * claims diff.
 */
const SUBJECT = "corpus_subject_0001";
const AUDIENCE: Array<string> = ["https://rs.corpus.lindorm.test"];
const CLIENT_ID = "corpus_client_0001";

/** The id token's audience IS the client (OIDC Core §2), stated as the one-member array the claim takes. */
const CLIENT_AUDIENCE: Array<string> = [CLIENT_ID];

/**
 * A content bag whose claims carry PRIVATE-USE COSE labels (`roles`, `groups`),
 * which is what makes the `proprietary` knob observable at all: an interoperable
 * token keys them by their JOSE string name, an on-platform one by a compact
 * integer. A claim registered with a plain name (`sid`) is string-keyed either
 * way and would make the pair of rows identical.
 */
const LABELLED_CONTENT: SignContent = {
  subject: SUBJECT,
  expires: "1h",
  roles: ["corpus-role"],
  groups: ["corpus-group"],
};

/** A content bag carrying an empty member, so the `omit` knob has something to bite on. */
const OMITTABLE_CONTENT: SignContent = {
  subject: SUBJECT,
  expires: "1h",
  scope: [],
  nonce: "",
};

const OBJECT_PAYLOAD: PayloadCell = {
  kind: "object",
  value: { corpus: "opaque-object", nested: { depth: 1 }, list: [1, 2, 3] },
};

const STRING_PAYLOAD: PayloadCell = {
  kind: "string",
  value: "corpus opaque string payload",
};

/** 24 fixed bytes — a length that is neither a block nor a digest, so padding shows. */
const BYTES_PAYLOAD: PayloadCell = {
  kind: "bytes",
  hex: "00112233445566778899aabbccddeeff0102030405060708",
};

/**
 * The object an `encrypt` row seals — spelled in DOMAIN names on purpose.
 *
 * ⚠ `aegis.encrypt` seals it VERBATIM: `subject` stays `subject` and never
 * becomes `sub` or RFC 8392's label 2. The domain spelling is what makes a
 * regression to the deleted domain→wire translation legible — the plaintext
 * length would move on every one of these rows.
 */
const ENCRYPT_OBJECT: PayloadCell = {
  kind: "object",
  value: {
    subject: SUBJECT,
    audience: AUDIENCE,
    clientId: CLIENT_ID,
    scope: ["openid", "profile"],
  },
};

export const CORPUS_CASES: ReadonlyArray<CorpusCase> = [
  // ---------------------------------------------------------------- mint / jwt
  {
    verb: "mint",
    name: "mint-default-jwt-ec",
    note: "The JOSE baseline: the policy floor profile over an EC signature. Every other JWT row is read against this one.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0001" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-rsa",
    note: "The same claims under RS512 — an RSA `alg`, a 512-byte signature, and a deterministic one.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "rsa-sig",
    options: { tokenId: "corpus_jti_0002" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-okp",
    note: "EdDSA over Ed25519 — the OKP header shape, and the smallest deterministic signature aegis emits.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "okp-sig",
    options: { tokenId: "corpus_jti_0003" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-oct",
    note: "HS256 — the symmetric header shape on the JOSE wire, which no profile with an algClass floor can reach.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "oct-sig",
    options: { tokenId: "corpus_jti_0004" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-akp",
    note: "ML-DSA-65 — the post-quantum header shape and the largest signature in the corpus.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "akp-sig",
    options: { tokenId: "corpus_jti_0005" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-omit-undefined",
    note: 'The `omit` knob: "undefined" keeps the empty scope and nonce that "empty" would prune, so the claims bytes differ from the baseline.',
    profile: "default",
    format: "jwt",
    content: OMITTABLE_CONTENT,
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0006", omit: "undefined" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-omit-empty",
    note: 'The same content under the default "empty" prune — the other half of the omit pair, so a change in pruning shows as a diff between two rows rather than against nothing.',
    profile: "default",
    format: "jwt",
    content: OMITTABLE_CONTENT,
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0007", omit: "empty" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-typ",
    note: "An explicit `typ` overriding a profile that mandates none — the JOSE header type knob.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0008", typ: "application/corpus+jwt" },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-header-bag",
    note: "The caller header bag on the JOSE wire: `objectId` becomes `oid`, `contentType` becomes `cty`.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: {
      tokenId: "corpus_jti_0009",
      header: { objectId: "corpus_oid_0001", contentType: "application/json" },
    },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-header-jwks-uri",
    note: "A caller `jwksUri` on a key that publishes its own: the kit's value is a DEFAULT, so `jku` on the wire is the caller's, not the key's.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: {
      tokenId: "corpus_jti_0009b",
      header: { jwksUri: "https://corpus.lindorm.io/.well-known/jwks.json" },
    },
  },
  {
    verb: "mint",
    name: "mint-default-jwt-lifetime",
    note: "A per-call lifetime overriding the profile default — the `exp` claim, and nothing else, moves.",
    profile: "default",
    format: "jwt",
    content: { subject: SUBJECT },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0010", lifetime: "15m" },
  },
  {
    verb: "mint",
    name: "mint-access-token-jwt-ec",
    note: "RFC 9068 access token — the `application/at+jwt` typ and the profile's own required claim set.",
    profile: "access_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: AUDIENCE, clientId: CLIENT_ID },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0011" },
  },
  {
    verb: "mint",
    name: "mint-access-token-jwt-cert-thumbprint",
    note: "Cert binding, thumbprint mode with the SHA-1 companion — `x5t#S256` and `x5t` on the protected header.",
    profile: "access_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: AUDIENCE, clientId: CLIENT_ID },
    signKey: "ec-sig-cert",
    options: {
      tokenId: "corpus_jti_0012",
      bindCertificate: "thumbprint",
      certificateThumbprintSha1: true,
    },
  },
  {
    verb: "mint",
    name: "mint-access-token-jwt-cert-chain",
    note: "Cert binding, chain mode with the SHA-1 companion suppressed — the whole `x5c` chain on the wire and no `x5t`.",
    profile: "access_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: AUDIENCE, clientId: CLIENT_ID },
    signKey: "ec-sig-cert",
    options: {
      tokenId: "corpus_jti_0013",
      bindCertificate: "chain",
      certificateThumbprintSha1: false,
    },
  },
  {
    verb: "mint",
    name: "mint-id-token-jwt-ec",
    note: "OIDC id token — the bare `JWT` typ, and a profile whose token id is NOT auto-injected but is still stamped when stated.",
    profile: "id_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0014", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-id-token-jwt-encrypted-rsa",
    note: "Sign-then-encrypt on the JOSE wire with RSA-OAEP-256 key wrapping — the one JWE in the corpus whose encrypted-key segment is non-empty.",
    profile: "id_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    encryptKey: "rsa-enc",
    options: { tokenId: "corpus_jti_0015", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-id-token-jwt-encrypted-ecdh",
    note: "Sign-then-encrypt with ECDH-ES over P-521 — the ephemeral `epk` on the protected header and an empty encrypted-key segment.",
    profile: "id_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    encryptKey: "ec-enc",
    options: { tokenId: "corpus_jti_0016", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-id-token-jwt-encrypted-dir",
    note: "Sign-then-encrypt with a direct AES key — no key management on the wire at all, so only the IV, ciphertext and tag move.",
    profile: "id_token",
    format: "jwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    encryptKey: "oct-enc",
    options: { tokenId: "corpus_jti_0017", context: { accessTokenIssued: false } },
  },

  // ---------------------------------------------------------------- mint / cwt
  {
    verb: "mint",
    name: "mint-default-cwt-ec",
    note: "The COSE baseline: the same claims as the JOSE baseline, so the two wires can be read side by side.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0018" },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-rsa",
    note: "RS512 on the COSE wire — a deterministic signature, so this row's token bytes are captured verbatim.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "rsa-sig",
    options: { tokenId: "corpus_jti_0019" },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-okp",
    note: "EdDSA on the COSE wire — COSE label -8, whose curve is resolved from the key rather than the label.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "okp-sig",
    options: { tokenId: "corpus_jti_0020" },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-akp",
    note: "ML-DSA-65 on the COSE wire — RFC 9964 label -49.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "akp-sig",
    options: { tokenId: "corpus_jti_0021" },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-interoperable",
    note: "`proprietary: false` — the interop spelling, where a private-use claim label is written under its JOSE string key instead.",
    profile: "default",
    format: "cwt",
    content: LABELLED_CONTENT,
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0022", proprietary: false },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-proprietary",
    note: "The same content with the on-platform compact integer labels — the other half of the proprietary pair.",
    profile: "default",
    format: "cwt",
    content: LABELLED_CONTENT,
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0023", proprietary: true },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-header-bag",
    note: "The caller header bag on the COSE wire: the SAME domain option that produced `oid` on JOSE lands at the COSE label the parameter rides under. `oid` has no IANA COSE parameter, so it takes a lindorm PRIVATE-USE label — and this row states no `proprietary`, so it is the INTEROPERABLE spelling: the text label `oid` (RFC 9052 §1.5, `label = int / tstr`), not the integer RFC 8152 §16.2 leaves to private use and no foreign reader can interpret. The row below holds the other spelling.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: {
      tokenId: "corpus_jti_0024",
      header: { objectId: "corpus_oid_0001", contentType: "application/json" },
    },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-header-bag-proprietary",
    note: "The same header bag on-platform — the other half of the interop pair, and the only row that holds the private-use header label as an INTEGER. Without it the corpus would record one spelling of a parameter that has two, and a change that collapsed them back onto the compact form everywhere would move nothing here. `contentType` (label 3) is registered, so it is the integer in BOTH rows: the mode moves the private-use label and nothing else.",
    profile: "default",
    format: "cwt",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "ec-sig",
    options: {
      tokenId: "corpus_jti_0024",
      header: { objectId: "corpus_oid_0001", contentType: "application/json" },
      proprietary: true,
    },
  },
  {
    verb: "mint",
    name: "mint-default-cwt-omit-undefined",
    note: "The `omit` knob on the COSE wire — the counterpart of the JOSE pair, because pruning happens above the wire and must reach both.",
    profile: "default",
    format: "cwt",
    content: OMITTABLE_CONTENT,
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0025", omit: "undefined" },
  },
  {
    verb: "mint",
    name: "mint-access-token-cwt-ec",
    note: "RFC 9068 access token on the COSE wire — the `application/at+cwt` media type at COSE label 16.",
    profile: "access_token",
    format: "cwt",
    content: { subject: SUBJECT, audience: AUDIENCE, clientId: CLIENT_ID },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0026" },
  },
  {
    verb: "mint",
    name: "mint-id-token-cwt-ec",
    note: "The id token on the COSE wire — a profile whose JOSE typ is the bare `JWT` has to say something else here.",
    profile: "id_token",
    format: "cwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    options: { tokenId: "corpus_jti_0027", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-id-token-cwt-encrypted-dir",
    note: "Sign-then-encrypt on the COSE wire — a COSE_Encrypt0 whose IV rides the unprotected bucket (RFC 9052 §5.2).",
    profile: "id_token",
    format: "cwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    encryptKey: "oct-enc",
    options: { tokenId: "corpus_jti_0028", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-id-token-cwt-encrypted-gcm128",
    note: "The same wrapper under A128GCM — the content encryption is the one property of the resolved key legible from the protected bucket.",
    profile: "id_token",
    format: "cwt",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "ec-sig",
    encryptKey: "oct-enc-gcm128",
    options: { tokenId: "corpus_jti_0029", context: { accessTokenIssued: false } },
  },

  // ---------------------------------------------------------------- mint / cwm
  {
    verb: "mint",
    name: "mint-default-cwm-oct",
    note: "COSE_Mac0 — the symmetric COSE structure, which is a different tag chain from the signed one for the same claims.",
    profile: "default",
    format: "cwm",
    content: { subject: SUBJECT, expires: "1h" },
    signKey: "oct-sig",
    options: { tokenId: "corpus_jti_0030" },
  },
  {
    verb: "mint",
    name: "mint-id-token-cwm-oct",
    note: "A MACed id token — OIDC Core §10.1 permits an HS-signed id token for a confidential client, and this is its COSE form.",
    profile: "id_token",
    format: "cwm",
    content: { subject: SUBJECT, audience: CLIENT_AUDIENCE },
    signKey: "oct-sig",
    options: { tokenId: "corpus_jti_0031", context: { accessTokenIssued: false } },
  },
  {
    verb: "mint",
    name: "mint-default-cwm-interoperable",
    note: "The interop label spelling on the MACed structure — `proprietary` is a claim-encoding knob, so it must reach cwm as well as cwt.",
    profile: "default",
    format: "cwm",
    content: LABELLED_CONTENT,
    signKey: "oct-sig",
    options: { tokenId: "corpus_jti_0032", proprietary: false },
  },

  // ---------------------------------------------------------------- sign / jws
  {
    verb: "sign",
    name: "sign-jws-object-ec",
    note: "An opaque JWS over a JSON object — no claims layer, so the payload bytes are the caller's own serialisation.",
    format: "jws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
  },
  {
    verb: "sign",
    name: "sign-jws-string-okp",
    note: "An opaque JWS over a string — the payload passes through untouched, which is the property that separates `sign` from `mint`.",
    format: "jws",
    payload: STRING_PAYLOAD,
    signKey: "okp-sig",
  },
  {
    verb: "sign",
    name: "sign-jws-bytes-oct",
    note: "An opaque JWS over raw bytes under HS256 — the payload segment is base64url of exactly those bytes.",
    format: "jws",
    payload: BYTES_PAYLOAD,
    signKey: "oct-sig",
  },
  {
    verb: "sign",
    name: "sign-jws-object-token-type",
    note: "The `tokenType` knob — the domain token type becomes the media type in the JOSE `typ` header.",
    format: "jws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
    options: { tokenType: "access_token" },
  },
  {
    verb: "sign",
    name: "sign-jws-object-header-bag",
    note: "The caller header bag on the opaque JOSE path — the same translation the mint path performs, reached through a different door.",
    format: "jws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
    options: { header: { objectId: "corpus_oid_0002" } },
  },
  {
    verb: "sign",
    name: "sign-jws-object-cert",
    note: "Cert binding on the opaque JOSE path — `sign` and `mint` resolve the binding through the same code, so both must be held.",
    format: "jws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig-cert",
    options: { bindCertificate: "thumbprint", certificateThumbprintSha1: false },
  },

  // ---------------------------------------------------------------- sign / cws
  {
    verb: "sign",
    name: "sign-cws-object-ec",
    note: "An opaque COSE_Sign1 over a JSON object — the CWS content codec stamps `application/json` and the payload stays a bstr.",
    format: "cws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
  },
  {
    verb: "sign",
    name: "sign-cws-string-okp",
    note: "An opaque COSE_Sign1 over a string under a deterministic signature — this row's token bytes are captured verbatim.",
    format: "cws",
    payload: STRING_PAYLOAD,
    signKey: "okp-sig",
  },
  {
    verb: "sign",
    name: "sign-cws-bytes-oct",
    note: "Raw bytes under a shared secret — a CWS with a symmetric key is a COSE_Mac0, not a COSE_Sign1.",
    format: "cws",
    payload: BYTES_PAYLOAD,
    signKey: "oct-sig",
  },
  {
    verb: "sign",
    name: "sign-cws-object-token-type",
    note: "The `tokenType` knob on the COSE wire — the same domain option produces a `+cws` media type here.",
    format: "cws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
    options: { tokenType: "access_token" },
  },
  {
    verb: "sign",
    name: "sign-cws-object-header-bag",
    note: "The caller header bag on the opaque COSE path — the same parameter the JOSE twin writes, at the COSE label it rides under. `oid` is a lindorm PRIVATE-USE label and this row states no `proprietary`, so the interoperable spelling is on the wire: the text label `oid`, which every conformant COSE reader can parse, rather than the private-use integer only lindorm can interpret.",
    format: "cws",
    payload: OBJECT_PAYLOAD,
    signKey: "ec-sig",
    options: { header: { objectId: "corpus_oid_0002" } },
  },

  // --------------------------------------------------------------- encrypt/jwe
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-rsa",
    note: "A domain-named object sealed to an RSA-OAEP-256 recipient — no inner signature, and a non-empty encrypted-key segment. The plaintext is the caller's own JSON, so `cty` is `application/json`.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "rsa-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-ecdh",
    note: "A domain-named object sealed under ECDH-ES over P-521 — the ephemeral key on the protected header.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "ec-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-ecdh-party",
    note: "The ECDH-ES party info (RFC 7518 §4.6) — `apu`/`apv` are emitted AND fed to the KDF, so they change the header and the ciphertext together.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "ec-enc",
    options: {
      partyProducer: "Y29ycHVzLXByb2R1Y2Vy",
      partyRecipient: "Y29ycHVzLXJlY2lwaWVudA",
    },
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-okp-ecdh",
    note: "ECDH-ES over X25519 — an OKP ephemeral key, whose `epk` has no `y` member.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "okp-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-opaque-string-dir",
    note: "An opaque string sealed with a direct key — the `cty` says `text/plain`, which is the read side's reconstruction cue.",
    format: "jwe",
    data: STRING_PAYLOAD,
    encryptKey: "oct-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-opaque-bytes-dir",
    note: "Opaque bytes sealed with a direct key — no `cty` interpretation at all, so the plaintext is returned as bytes.",
    format: "jwe",
    data: BYTES_PAYLOAD,
    encryptKey: "oct-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-opaque-bytes-cbc",
    note: "AES-CBC-HMAC content encryption — registered for JOSE (RFC 7518 §5.2.5) and private-use for COSE, so the same key is standard here and gated there.",
    format: "jwe",
    data: BYTES_PAYLOAD,
    encryptKey: "oct-enc-cbc",
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-type",
    note: "The `type` knob — the domain token type becomes the JWE media type in `typ`.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc",
    options: { type: "access_token" },
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-header-bag",
    note: "The caller header bag on the encrypt path — reaching the JWE writer, which is the only encrypt path that takes one.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc",
    options: { header: { objectId: "corpus_oid_0003" } },
  },
  {
    verb: "encrypt",
    name: "encrypt-jwe-claims-cert",
    note: "Cert binding on a JWE — the recipient key carries a chain, so the thumbprint rides the protected header.",
    format: "jwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "ec-enc-cert",
    options: { bindCertificate: "thumbprint" },
  },

  // --------------------------------------------------------------- encrypt/cwe
  {
    verb: "encrypt",
    name: "encrypt-cwe-claims-dir",
    note: "A domain-named object sealed as a COSE_Encrypt0 — the plaintext is the caller's own JSON under the caller's own keys, so `cty` (label 3) is `application/json`, the same answer every other opaque door gives. ⚠ It is NOT the RFC 8392 Message: an encrypt has no signature behind it, so it may not promote `subject` to the registered label 2 that a conformant reader would take for an asserted claim. Sealing a CWT is `mint(…, { encrypt })`, which signs first.",
    format: "cwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-cwe-claims-gcm128",
    note: "The same object under A128GCM — the protected bucket's content encryption is what tells the two recipient keys apart.",
    format: "cwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc-gcm128",
  },
  {
    verb: "encrypt",
    name: "encrypt-cwe-claims-interoperable",
    note: "`proprietary: false` on the COSE seal — the D5 default, stated. On this verb it reaches ONLY the encryption registration gate: there is no claim codec on the encrypt path any more, so the flag cannot move the plaintext, and this row is byte-comparable to `encrypt-cwe-claims-dir` for that reason rather than because false is the default. ⚠ THE CORPUS CANNOT SEE A PLAINTEXT AT ALL — it is ciphertext — so the flag's inability to reach it is pinned by `src/classes/cose-claims-encoding.test.ts#does not let proprietary reach the plaintext at all`, which decrypts and compares the bytes; this row holds the wire length steady around it.",
    format: "cwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc",
    options: { proprietary: false },
  },
  {
    verb: "encrypt",
    name: "encrypt-cwe-claims-cbc-proprietary",
    note: "AES-CBC-HMAC on the COSE wire — private-use in RFC 9053 terms, so it is reachable only through the proprietary gate, which is the one thing that flag still decides here.",
    format: "cwe",
    data: ENCRYPT_OBJECT,
    encryptKey: "oct-enc-cbc",
    options: { proprietary: true },
  },
  {
    verb: "encrypt",
    name: "encrypt-cwe-opaque-bytes-dir",
    note: "Opaque bytes as a COSE_Encrypt0 — `cty` is `application/octet-stream` and the plaintext is returned as those bytes.",
    format: "cwe",
    data: BYTES_PAYLOAD,
    encryptKey: "oct-enc",
  },
  {
    verb: "encrypt",
    name: "encrypt-cwe-opaque-string-type",
    note: "An opaque string with a caller `type` — the one place an opaque `cwe` carries a media type of the caller's choosing.",
    format: "cwe",
    data: STRING_PAYLOAD,
    encryptKey: "oct-enc",
    options: { type: "access_token" },
  },
];

import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { SignatureKit } from "../../classes/SignatureKit.js";
import { AegisError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { algToCoseLabel } from "./alg-labels.js";
import { encodeCbor, Tag } from "./cbor.js";
import { encodeCwtClaims } from "./cwt-claims.js";
import { buildSigStructure, COSE_TAG, encodeProtectedHeader } from "./structures.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";
const NOW = 1704096000;

const ALG = coseByJose("alg");
const KID = coseByJose("kid");
const TYP = coseByJose("typ");

/**
 * AN UNSIGNED TYP CANNOT SATISFY A TYPE ASSERTION.
 *
 * RFC 9052 §3 splits a COSE header into a protected bucket the signature covers
 * and an unprotected bucket it does not. `typ` is what routes a token — it is
 * how a caller says "this must be an access token" and how the profile floor
 * decides which rules apply — so it may only ever be read from the bucket the
 * issuer signed. A `typ` that no signature covers can be rewritten by anyone
 * holding the token, so honouring it lets the PRESENTER answer the verifier's
 * question about what the token is.
 *
 * These are STANDALONE tests rather than conformance rows because the input
 * cannot be produced through the public mint: `buildCoseHeaders` refuses a caller
 * `typ` in either bag (it is kit-derived, `cose_reserved_header`), and on merge
 * the protected map wins anyway. The rule bites only on a CWT whose PROTECTED
 * header omits `typ` altogether — a shape only a hostile or foreign producer
 * emits, and therefore exactly the shape a verifier must not trust.
 *
 * So the structure is hand-built from the same primitives `CwsKit.signSign1`
 * uses, with the signature computed over the PROTECTED bucket and not the
 * unprotected one — RFC 9052 §4.4 `Sig_structure`, which covers the context
 * string, the protected header, `external_aad` and the payload, and nothing
 * from the unprotected map. Everything an attacker cannot touch — the key, the
 * algorithm, the claims — is genuine; only the typ's LOCATION differs.
 *
 * ⚠ KNOWN DEFECT (delete this paragraph when these go green): the `typ` that
 * drives the profile floor and the `tokenType` assertion is read off the MERGED
 * COSE header, and `mergeCoseWireHeader` includes the unprotected bucket.
 */
describe("COSE typ integrity", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  /**
   * Build a signed CWT whose protected header carries ONLY `alg`, placing `kid`
   * and (optionally) `typ` in the unprotected bucket. `typ` in the unprotected
   * map is the unsigned case; `typ` in the protected map is the signed one.
   */
  const buildCwt = ({
    typ,
    protectTyp,
  }: {
    typ: string;
    protectTyp: boolean;
  }): string => {
    const claims = {
      iss: ISSUER,
      sub: "user-1",
      aud: [RESOURCE],
      exp: NOW + 3600,
      iat: NOW,
      cti: "token-1",
      client_id: "client-1",
    };

    const payload = encodeCbor(encodeCwtClaims(claims));

    const protectedMap = new Map<number, unknown>([
      [ALG, algToCoseLabel(TEST_EC_KEY_SIG.algorithm)],
    ]);
    const unprotected = new Map<number, unknown>([
      [KID, Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
    ]);

    if (protectTyp) {
      protectedMap.set(TYP, typ);
    } else {
      unprotected.set(TYP, typ);
    }

    const protectedHeader = encodeProtectedHeader(protectedMap);
    const signature = new SignatureKit({ kryptos: TEST_EC_KEY_SIG, raw: true }).sign(
      buildSigStructure(protectedHeader, payload),
    );

    const sign1 = new Tag(COSE_TAG.sign1, [
      protectedHeader,
      unprotected,
      payload,
      signature,
    ]);

    return encodeCbor(new Tag(COSE_TAG.cwt, sign1)).toString("base64url");
  };

  // A signed typ IS authoritative — the issuer stated it and the signature covers
  // it, so the assertion it answers is answered by the issuer. This also
  // establishes that the hand-built structure is a genuine, verifiable CWT,
  // without which a rejection below would be indistinguishable from a malformed
  // token.
  test("should satisfy a token type assertion from an INTEGRITY-PROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: true });

    await expect(
      aegis.verify(token, { tokenType: "access_token" }),
    ).resolves.toMatchObject({ format: "cwt" });
  });

  // The rule itself, through the `tokenType` assertion door.
  //
  // ⚠ Both unsigned-typ assertions here name `AegisError`, not a bare `toThrow()`
  // and not a narrower class. Bare would go green after a repair on ANY throw — a
  // TypeError from a botched one, or a bare `LindormError`, which `AegisError`
  // EXTENDS and is therefore not an instance of. `AegisError` excludes both and
  // is what a consumer actually catches.
  //
  // Narrower would be a guess about a decision nobody has taken. Two repairs are
  // live and they throw different classes: teach the COSE readers to ignore the
  // unprotected bucket and the typ comparisons fail as they already do —
  // `AegisDomainError` (assert-cose-token-type.ts `cwt_typ_mismatch` here,
  // enforce-verify-floor.ts `jwt_typ_mismatch` at the floor); refuse the token at
  // DECODE instead, because a `typ` the SIGNATURE DOES NOT COVER cannot route
  // anything, and it is a `CoseError`. ⚠ Scope that reasoning to `typ` alone —
  // "a kit-derived header has no business in an unsigned bag" would be false
  // here: `CwsKit.buildHeaders` puts the kit-derived `kid` in the UNPROTECTED map
  // on every CWT/CWS aegis mints (CwsKit.ts:352, reserved at :366, deliberate
  // COSE convention per :332-335) and `decodeCwt` reads it back from there
  // (cwt-token.ts:358), so the broad form would refuse every token this package
  // produces — including the signed-typ case above. `AegisError` is the broadest
  // class the contract promises and the only one that survives either repair. No
  // `data` for the same reason: the error does not exist yet, so its `data`
  // cannot be read off anything — pin it once the fix lands.
  test("should NOT satisfy a token type assertion from an UNPROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    await expect(aegis.verify(token, { tokenType: "access_token" })).rejects.toThrow(
      AegisError,
    );
  });

  // Where the two readers of `typ` currently disagree, pinned rather than
  // asserted-against. `cwt-token.ts` reads the PROTECTED map alone when it builds
  // the parsed header, so `header.tokenType` comes back undefined; `CwsKit` reads
  // the MERGED map, so the typ-driven checks above are satisfied by the
  // unprotected copy. One token, two answers.
  //
  // ⚠ This records TODAY's behaviour, so it is GREEN. It exists because it
  // survives a PARTIAL repair: teach only the merged reader to ignore the
  // unprotected bucket and the two assertions above go green while this stays
  // green; teach only the parsed-header reader to merge and this goes RED with
  // those two still failing. Either way the remaining half is named.
  //
  // ⚠ LIFECYCLE — this pin covers ONE of the two live repairs. Under the OTHER
  // (refuse the token at DECODE, `CoseError`) the bare verify below THROWS and
  // this pin fails. That is RETIREMENT, not regression: the decode refusal
  // subsumes what this pin exists to say, because a token whose typ the
  // signature does not cover no longer reaches a reader at all. Disposal in that
  // case is to DELETE this test — do not wrap the verify in a rejection
  // assertion, which would silently convert a divergence pin into a duplicate of
  // the rule above.
  //
  // ⚠ The verify is DELIBERATELY assertion-free. Passing `{ tokenType: … }` here
  // would route this pin through the very acceptance the rule above says must be
  // REFUSED, so the repair that turns that green would turn this ERROR — a pin
  // that cannot survive the repair it claims to survive. The parsed header is
  // reachable without asking the merged reader anything, so ask it nothing.
  test("should report NO token type on the parsed header when the typ is UNPROTECTED", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    const verified = await aegis.verify(token);

    expect(verified.header.tokenType).toBeUndefined();
  });

  // The same rule through the PROFILE floor, which compares the token's typ
  // against `coseTyp(profile.typ)` — the access_token profile mandates one, so an
  // unsigned typ deciding that comparison is the reachable consequence. The
  // error-class reasoning is the one stated above.
  test("should NOT satisfy the access_token profile floor from an UNPROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).rejects.toThrow(AegisError);
  });
});

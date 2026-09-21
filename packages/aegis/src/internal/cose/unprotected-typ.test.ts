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
 * AN UNSIGNED TYP CANNOT SATISFY A TYPE ASSERTION. RFC 9052 §3, RFC 9052 §4.4.
 *
 * `typ` is what routes a token — how a caller says "this must be an access
 * token", and what the profile floor compares against — so honouring an
 * unprotected copy lets the PRESENTER answer the verifier's question.
 *
 * STANDALONE rather than feature scenarios: the input cannot come through the
 * public mint. `buildCoseHeaders` refuses a caller `typ` in either bag
 * (`cose_reserved_header`) and the protected map wins on merge, so the rule bites
 * only on a CWT whose protected header omits `typ` — which only a foreign or
 * hostile producer emits. The structure is therefore hand-built from the same
 * primitives `CwsKit.sign` uses; only the typ's LOCATION differs.
 *
 * ⚠ It holds because the kits report the two buckets separately
 * ({@link CoseHeaderBuckets}) and the verify path reads `typ` off the protected
 * one alone. A merged read is what this file catches.
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

  // A signed typ IS authoritative. This also establishes that the hand-built
  // structure is a genuine, verifiable CWT — without it a rejection below is
  // indistinguishable from a malformed token.
  test("should satisfy a token type assertion from an INTEGRITY-PROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: true });

    await expect(
      aegis.verify(token, { tokenType: "access_token" }),
    ).resolves.toMatchObject({ format: "cwt" });
  });

  // The rule itself, through the `tokenType` assertion door.
  //
  // ⚠ `AegisError`, not a bare `toThrow()`: bare goes green on a `TypeError` from
  // a botched repair, and on a bare `LindormError`, which `AegisError` extends and
  // is not an instance of.
  //
  // ⚠ It stays the BROAD class: narrowing pins WHICH check happens to notice
  // (`assert-cose-token-type.ts` or `enforce-verify-floor.ts`), and the rule is
  // that an unsigned typ answers nothing. ⚠ Scope that to `typ` alone — a broad
  // "no kit-derived header in an unsigned bag" is false here, because
  // `CwsKit.buildHeaders` puts the kit-derived `kid` in the UNPROTECTED map on
  // every CWT/CWS aegis mints (RFC 9052 §3.1) and `decodeCwt` reads it back.
  test("should NOT satisfy a token type assertion from an UNPROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    await expect(aegis.verify(token, { tokenType: "access_token" })).rejects.toThrow(
      AegisError,
    );
  });

  // The two readers of `typ` AGREE. The domain header IS a merge of both buckets,
  // but `typ` is `placement: "protected"` in the header registry, so an unsigned
  // one is filtered on the way in and produces no `tokenType` at all.
  //
  // ⚠ The verify is assertion-free on purpose: passing `{ tokenType: … }` routes
  // this through the acceptance the rule above refuses, making it a duplicate of
  // that rule rather than a statement about what the parsed header REPORTS.
  test("should report NO token type on the parsed header when the typ is UNPROTECTED", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    const verified = await aegis.verify(token);

    expect(verified.header.tokenType).toBeUndefined();
  });

  // The same rule through the PROFILE floor, which compares the token's typ
  // against `coseTyp(profile.typ)`. Error class as reasoned above.
  test("should NOT satisfy the access_token profile floor from an UNPROTECTED typ", async () => {
    const token = buildCwt({ typ: "application/at+cwt", protectTyp: false });

    await expect(
      aegis.verify("access_token", token, undefined, { audience: RESOURCE }),
    ).rejects.toThrow(AegisError);
  });
});

import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN RFC 7800 `cnf` ACTUALLY SAYS ON EACH WIRE.
 *
 * ⚠⚠ WHAT WAS MEASURED BEFORE THIS FILE, and it is why the file exists. `cnf` was
 * the only one of the six structured claims with NO JOSE byte pin at all:
 *   - COSE had a real one — `classes/cose-claims-encoding.test.ts` reads claim
 *     label 8 and member label 3 out of raw `cbor2` and asserts the JOSE spelling
 *     is gone — but it pins ONE member. Label 1, the embedded COSE_Key, was
 *     unpinned on the wire.
 *   - JOSE had only `classes/JwtKit.test.ts`'s "confirmation claim (wire)" block,
 *     which reads the payload back through `JwtKit.decode` — aegis's OWN decoder —
 *     and snapshots an alphabetically sorted object. That is order-insensitive and
 *     self-consistent by construction, and neither of its two snapshots contains a
 *     `jwk` member at all.
 * So a claim carrying a proof-of-possession binding — the one claim whose whole
 * purpose is that a THIRD party can check it — was held on JOSE by a round trip
 * through the package that wrote it.
 *
 * ⛔ EVERY ASSERTION HERE GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing nothing
 * from `src/internal/` or `src/classes/`). Reading the token back through aegis's
 * own decoder proves only that the writer and the reader agree, which a pair of
 * mirrored bugs satisfies exactly.
 *
 * ⛔ THE EXPECTED SPELLINGS AND LABELS BELOW ARE WRITTEN OUT, NOT READ FROM
 * `internal/claims/cnf-members.ts`. A test that derived them would agree with
 * whatever the declaration currently says — including a wrong label — so it could
 * state that the wire matches the registry but never that the wire matches
 * RFC 7800.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/** A real 32-byte SHA-256 digest, base64url-encoded (RFC 7638 / RFC 9449 §6.1). */
const JKT = "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I";
const X5T = "A4DtL2JmUMhAsvJj5tKyn64SqzmuXbMrJa0n761y5v0";
const KID = "cnf-wire-key-id";
const JKU = "https://rs.lindorm.test/.well-known/jwks.json";

/**
 * The confirmed key, as a JWK. It is a P-256 public key so the COSE_Key form has
 * something to assert about at every label — `kty`, `crv`, `x` and `y`.
 */
const CNF_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
  y: "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
};

/** The claim key `cnf` takes on each wire: a JOSE name, and RFC 8747 §7.1's label 8. */
const CNF_COSE_CLAIM_LABEL = 8;

/**
 * The MEMBER labels registered for `cnf` — `COSE_Key` 1, `kid` 3 (RFC 8747 §3.1),
 * written out. They are IANA-registered, which is why the COSE `cnf` map rides
 * them on EVERY token rather than only in the proprietary encoding: an
 * interoperable reader is expected to understand them.
 */
const COSE_KEY = 1;
const COSE_KID = 3;

/** COSE_Key parameter labels (RFC 9052 §7) and curve labels (RFC 9053 §7.1). */
const KEY_KTY = 1;
const KEY_CRV = -1;
const KEY_X = -2;
const KEY_Y = -3;
const KTY_EC2 = 2;
const CRV_P256 = 1;

const logger = createMockLogger();

let aegis: Aegis;

beforeAll(async () => {
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  aegis = new Aegis({ amphora, logger });
});

const mint = async (
  format: "jwt" | "cwt",
  confirmation: Dict,
  proprietary?: true,
): Promise<string> => {
  const signed = await aegis.mint(
    "default",
    { subject: "user-1", expires: "1h", confirmation } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "cnf-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw `cnf` claim a token carries, in the wire's own vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against a structure
 * is the vacuous pass the inspector exists to prevent.
 */
const cnfOf = (token: string, key: number | string): unknown => {
  const inspection = inspectToken(token);

  if (inspection.payload.readable === false) {
    throw new Error(`the payload cannot be read: ${inspection.payload.reason}`);
  }

  const claims = inspection.payload.value;
  const value =
    inspection.wire === "jose"
      ? (claims as Dict)[String(key)]
      : (claims as ReadonlyMap<number | string, unknown>).get(key);

  if (value === undefined) {
    throw new Error(`the token carries no cnf under ${String(key)}`);
  }

  return value;
};

describe("the confirmation claim on the wire", () => {
  test("a JOSE token spells every confirmation member the way its specification does", async () => {
    const token = await mint("jwt", {
      thumbprint: JKT,
      mtlsCertThumbprint: X5T,
      key: CNF_JWK,
      keyId: KID,
      jwkSetUri: JKU,
    });

    // Whole-value equality, not a subset: a subset match passes over a member the
    // token dropped, and a DROPPED confirmation member is the failure the whole
    // per-member refusal machinery exists to prevent — a token asserting a binding
    // narrower than the one its author wrote.
    //
    // ⭐ EVERY MEMBER CARRIES A VALUE ASSERTION, and the values are all distinct,
    // so a builder that wrote the right five keys with two of the values swapped
    // fails here. (`jkt` and `x5t#S256` are both 43-character base64url digests —
    // exactly the pair a copy-paste would transpose.)
    expect(cnfOf(token, "cnf")).toEqual({
      jkt: JKT,
      "x5t#S256": X5T,
      jwk: CNF_JWK,
      kid: KID,
      jku: JKU,
    });
  });

  test("a JOSE token keeps the confirmation members in the order the caller wrote them", async () => {
    // JSON preserves insertion order, so the BYTES of a JOSE `cnf` are decided by
    // the order its members were written in. The translator walks the VALUE rather
    // than the declaration for exactly this reason; a walk over the declaration
    // would re-order a caller's confirmation and move bytes on a signed wire while
    // every round trip still passed.
    // ⚠⚠ THE INPUT MUST DIFFER FROM ALL THREE ORDERS A BROKEN WALK COULD PRODUCE,
    // and getting that wrong twice is why this comment is long. The expected
    // `["kid","jkt","jku"]` is:
    //   - NOT sorted by WIRE name        (that is `["jkt","jku","kid"]`)
    //   - NOT sorted by DOMAIN name      (`jwkSetUri` < `keyId` < `thumbprint`
    //     → `["jku","kid","jkt"]` — which is why the caller order below is
    //     `keyId, thumbprint, jwkSetUri` and NOT the other way round)
    //   - NOT the DECLARATION order      (`thumbprint, mtlsCertThumbprint, key,
    //     keyId, jwkSetUri` → `["jkt","kid","jku"]`)
    // The first version of this test used `{ keyId, thumbprint }`, where sorting
    // is the identity; the second used `{ thumbprint, keyId }`, which the
    // DECLARATION order also reproduces. Both passed against the mutation this
    // test exists to catch. Three orders, three ways to be vacuous — hence three
    // lines of arithmetic above the assertion.
    const token = await mint("jwt", {
      keyId: KID,
      thumbprint: JKT,
      jwkSetUri: JKU,
    });

    expect(Object.keys(cnfOf(token, "cnf") as Dict)).toEqual(["kid", "jkt", "jku"]);
  });

  test("a JOSE token carries an undeclared confirmation member untouched", async () => {
    // Other specifications register confirmation methods (RFC 7800 §3.1,
    // RFC 7800 §6.2) and a method name is case sensitive (RFC 7800 §6.2.1), so the
    // member must reach the wire with the spelling its own specification gave it:
    // NOT snake_cased, and not dropped.
    const token = await mint("jwt", { keyId: KID, tlsClientAuth: "surprise" });

    expect(cnfOf(token, "cnf")).toEqual({ kid: KID, tlsClientAuth: "surprise" });
  });

  test("a JOSE mint refuses a member spelled in the WIRE vocabulary, alone", async () => {
    // ⛔⛔ THE REGRESSION THIS PINS. `jkt` is what every RFC and every other
    // library calls the thumbprint, so a caller writing it into the DOMAIN bag is
    // the likely mistake, not an exotic one — and `ConfirmationClaim` is
    // `ConfirmationClaimMembers & Dict`, so it compiles clean. With the
    // reservation made only by ARRIVING members, `jkt` alone had nothing to
    // collide with: it fell into the verbatim tail, reached the wire under its own
    // key with the RFC 7638 32-byte grammar never run (that rule reads the DOMAIN
    // name), and aegis minted `cnf: { jkt: "" }` — a token its OWN verifier then
    // refused `confirmation_binds_no_key`.
    //
    // ⚠ ALONE is the whole point. The declared `thumbprint` is absent here.
    await expect(mint("jwt", { jkt: "abc" })).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: { claim: "confirmation" },
    });
  });

  test("a JOSE mint refuses the two spellings together, in EITHER order", async () => {
    // Both orders, because which name arrives second is the caller's to choose and
    // a presence-ordered reservation answers them differently. Two VALID
    // thumbprints, so the profile's 32-byte grammar rule cannot refuse first and
    // mask the collision — this must be the COLLISION refusal, not any refusal.
    const other = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE";

    // ⚠ ONE entry here, not two: the declared `thumbprint` survives and fills the
    // bag, so `cnfBinding` has nothing to add. That the two rows differ in entry
    // COUNT is itself the check — it is what says the collision is reported for
    // the collision rather than folded into the emptiness verdict.
    const collision = {
      code: "claim_structure_invalid",
      data: {
        claim: "confirmation",
        invalid: [
          {
            key: "confirmation.jkt",
            message:
              'Members "jkt" and "thumbprint" both resolve to "jkt" in "confirmation"',
          },
        ],
      },
    };

    await expect(mint("jwt", { thumbprint: JKT, jkt: other })).rejects.toMatchObject(
      collision,
    );
    await expect(mint("jwt", { jkt: other, thumbprint: JKT })).rejects.toMatchObject(
      collision,
    );
  });

  test("a foreign token spelling a member in the DOMAIN vocabulary is refused on read", async () => {
    // ⛔ THE READ HALF, and it is the half that reaches a security gate. A reader
    // ignores a confirmation member it does not understand (RFC 7800 §3.1) — and
    // `thumbprint` is not a member anyone registered, it is aegis's own domain
    // name. Carried verbatim it lands on `confirmation.thumbprint`, the exact slot
    // `internal/utils/apply-verify-policy.ts` reads as the bound thumbprint, so a
    // stranger's token would drive the DPoP gate through a name no RFC defines.
    //
    // ⭐ What genuinely improved beside it: at HEAD `{ jkt, thumbprint }` let the
    // look-alike WIN — the old decoder preferred the domain spelling, returning
    // `thumbprint: "evil"` and DISCARDING the real `jkt`. Both are refused now.
    const signed = await aegis.jwt.sign(
      {
        iss: ISSUER,
        sub: "user-1",
        aud: ["https://rs.lindorm.test"],
        exp: Math.floor(Date.now() / 1000) + 120,
        cnf: { thumbprint: "abc" },
      } as never,
      { tokenType: "access" } as never,
    );

    expect(() => aegis.parse(signed.token)).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }),
    );
  });

  test("a COSE token keys the confirmation by RFC 8747's registered labels, on an interoperable token", async () => {
    // ⚠ NO `proprietary` FLAG. The `cnf` member labels are IANA-registered
    // (RFC 8747 §3.1), so the
    // COSE `cnf` map is what a STOCK reader expects — unlike the actor chain's
    // compact map, whose `client_id` (4) and `act` (5) are lindorm's own and ride
    // only on-platform. A `cnf` that degraded to string keys off-platform would be
    // unreadable to every conformant CWT verifier.
    const token = await mint("cwt", { key: CNF_JWK, keyId: KID });

    const cnf = cnfOf(token, CNF_COSE_CLAIM_LABEL) as Map<number | string, unknown>;

    expect(cnf).toBeInstanceOf(Map);
    // ⭐ LABEL 1 IS A COSE_Key (RFC 8747 §3.1) — an integer-labelled CBOR map,
    // NOT the JWK the caller handed over. Every parameter is asserted, because a
    // transcoder that wrote the right label with the wrong curve mints a binding
    // to a key nobody holds.
    expect(cnf.get(COSE_KEY)).toEqual(
      new Map<number, unknown>([
        [KEY_KTY, KTY_EC2],
        [KEY_CRV, CRV_P256],
        [KEY_X, Buffer.from(CNF_JWK.x, "base64url")],
        [KEY_Y, Buffer.from(CNF_JWK.y, "base64url")],
      ]),
    );
    // Label 3, as a BYTE STRING (RFC 8747 §3.4) rather than the text the JOSE form
    // carries.
    expect(cnf.get(COSE_KID)).toEqual(Buffer.from(KID, "utf8"));

    // ⛔ AND THE JOSE SPELLINGS ARE GONE. The integer `1` and the text `"jwk"` are
    // different labels (RFC 9052 §1.5), so a shaper that handed the JOSE object
    // through untouched would put members on the wire that
    // no CWT reader looks for. This is the half that fails on a pass-through.
    expect(cnf.has("jwk")).toBe(false);
    expect(cnf.has("kid")).toBe(false);
  });

  test("a COSE token keys the confirmation identically in the proprietary encoding", async () => {
    // The proprietary flag governs the LINDORM label maps. RFC 8747's are
    // registered, so this token and the interoperable one above must be the same
    // bytes at the `cnf` — asserted rather than assumed, because "the flag does
    // not reach this claim" is precisely the kind of fact that stops being true
    // quietly.
    const token = await mint("cwt", { key: CNF_JWK, keyId: KID }, true);

    const cnf = cnfOf(token, CNF_COSE_CLAIM_LABEL) as Map<number | string, unknown>;

    expect([...cnf.keys()]).toEqual([COSE_KEY, COSE_KID]);
    expect(cnf.get(COSE_KID)).toEqual(Buffer.from(KID, "utf8"));
  });

  test("a COSE mint refuses every member the wire cannot carry, naming it", async () => {
    // ⭐ THE `wireAbsent` MEMBERS, PROVEN ABSENT BY THE REFUSAL THAT SAYS WHY.
    // There is no positive byte assertion to make for `jkt` / `x5t#S256` / `jku` on
    // COSE — the whole point is that no bytes exist — so what is pinned instead is
    // that the mint FAILS CLOSED rather than dropping them. No CWT confirmation
    // method is registered for `jkt` (RFC 9679 §5.5), and none for the other two
    // (RFC 8747 §3.1).
    //
    // ⚠ `keyId` IS representable and is absent from the reported list, which is
    // what makes this a per-MEMBER refusal rather than an all-or-nothing one:
    // dropping the unrepresentable members and keeping the rest would mint an
    // UNBOUND CWT the verifier never asked for a proof for.
    await expect(
      mint("cwt", {
        thumbprint: JKT,
        mtlsCertThumbprint: X5T,
        jwkSetUri: JKU,
        keyId: KID,
      }),
    ).rejects.toMatchObject({
      name: "CoseError",
      code: "cose_cnf_unsupported",
      data: { members: ["jkt", "x5t#S256", "jku"] },
    });
  });

  test("a COSE mint refuses an undeclared member the JOSE wire carries untouched", async () => {
    // ⭐ THE JOSE/COSE ASYMMETRY AT THE PUBLIC DOOR, on the SAME confirmation the
    // JOSE row above mints: `internal/claims/cnf-members.ts` is not an allowlist on
    // JOSE and is one on COSE. The member is UNDECLARED, so it reaches the byte
    // layer through `aegis.mint` rather than through the standalone `encodeCnf`
    // door `internal/cose/cose-key.ts`'s unit rows use.
    //
    // ⚠ `keyId` is representable and is absent from the reported list, which is what
    // says the refusal names the member rather than the whole confirmation.
    await expect(
      mint("cwt", { keyId: KID, tlsClientAuth: "surprise" }),
    ).rejects.toMatchObject({
      name: "CoseError",
      code: "cose_cnf_unsupported",
      data: { members: ["tlsClientAuth"] },
    });
  });

  test("a null confirmation member is refused, not erased into a weaker binding", async () => {
    // ⭐⭐ THE `cnf` EXEMPTION FROM THE NULL RULING, PINNED WITH THE FAULT THAT
    // EARNED IT. Everywhere else a null member is an ABSENCE and is omitted; a
    // confirmation member is not, and this row is the reason. Taking the carve-out
    // erases the null member inside `domainToWire` BEFORE the COSE fail-closed
    // guard runs — and that guard asks `cnf[member] !== undefined`
    // (`internal/cose/cose-key.ts`), so an erased `jkt` is not "unrepresentable",
    // it is nothing:
    //   `{ thumbprint: JKT,  keyId: KID }` → REFUSE `cose_cnf_unsupported`
    //   `{ thumbprint: null, keyId: KID }` → MINTS a CWT that verifies WITH NO
    //                                        PROOF, byte-identical to `{ keyId }`
    // A caller who asked for a thumbprint binding would receive a token nobody is
    // ever asked to prove possession for.
    //
    // ⚠ The `jkt` value is a base64url thumbprint (RFC 9449 §6.1), so `jkt: null`
    // CONTRADICTS the member's declared shape rather than leaving it unstated.
    // `undefined` remains the one absence a confirmation member recognises — see
    // the row above for `{ jwk: undefined, kid }` minting on the `kid` alone.
    //
    // ⚠⚠ THE SECOND ASSERTION IS THE ONE THAT BITES: pinning `cnf: { kid }` for a
    // minted `{ thumbprint: null, keyId }` would call the result "the key-id
    // binding its issuer wrote" when the issuer wrote a THUMBPRINT binding. A row
    // that pins the downgrade while its title denies it is worse than no row.
    await expect(
      mint("jwt", { thumbprint: null, keyId: KID } as Dict),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "confirmation",
        invalid: [
          {
            key: "confirmation.thumbprint",
            message: 'Member "thumbprint" must be a string',
          },
        ],
      },
    });

    // ⚠ THE CONTROL, so the row cannot pass by refusing everything: the same
    // confirmation WITHOUT the null member is a legitimate key-id binding and
    // still mints, on the wire, unchanged.
    expect(cnfOf(await mint("jwt", { keyId: KID }), "cnf")).toEqual({ kid: KID });

    // ⚠ AND THE LONE NULL MEMBER REPORTS BOTH FAULTS — the member that
    // contradicts its shape, and the confirmation left naming no key. Two entries,
    // because `toMatchObject` compares array length and a build that reported only
    // the second would have erased the member after all.
    await expect(mint("jwt", { thumbprint: null } as Dict)).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "confirmation",
        invalid: [
          {
            key: "confirmation.thumbprint",
            message: 'Member "thumbprint" must be a string',
          },
          {
            key: "confirmation",
            message: 'Claim "confirmation" names no key to confirm',
          },
        ],
      },
    });
  });

  test("a null UNDECLARED confirmation member rides verbatim, like every other tail value", async () => {
    // ⚠⚠ THE TAIL TAKES THE SAME `cnf` EXEMPTION THE DECLARED MEMBERS TAKE, and
    // this row exists because a mutation proved nothing else pinned it: flipping
    // the tail arm alone to the null carve-out left the whole suite green.
    //
    // Another specification may register a confirmation method (RFC 7800 §6.2),
    // so a tail member is SOMEBODY'S confirmation method rather than a spare
    // attribute — and a reader ignores what it does not understand rather than
    // editing it (RFC 7800 §3.1). Erasing a null one would let a caller state a
    // binding this package silently deletes, which is the same erasure the
    // declared-member row above measures, one column over.
    //
    // ⚠ The value rides UNTOUCHED and the KEY is not case-flipped: a confirmation
    // method name is case sensitive (RFC 7800 §6.2.1). `toEqual`, so a build that
    // dropped the member or renamed it fails rather than passing on a subset.
    expect(cnfOf(await mint("jwt", { thumbprint: JKT, someExt: null } as Dict), "cnf")) //
      .toEqual({ jkt: JKT, someExt: null });

    // The READ direction of the same rule, on a foreign token's wire spelling.
    expect(
      (Aegis.toDomain({ cnf: { jkt: JKT, some_ext: null } } as Dict).claims as Dict)
        .confirmation,
    ).toEqual({ thumbprint: JKT, some_ext: null });
  });

  test("a null confirmation member cannot mint an unbound CWT past the COSE guard", async () => {
    // ⭐⭐ THE COSE HALF, ON ITS OWN ROW, BECAUSE THE GUARD IT DEFENDS IS A
    // DIFFERENT ONE. The JOSE row above is refused by the translator; this asserts
    // that the null member never reaches the point where `internal/cose/cose-key.ts`
    // decides a confirmation has no COSE form. The two failures are one erasure
    // seen from two layers, and a fix applied at either layer alone leaves the
    // other open.
    await expect(
      mint("cwt", { thumbprint: null, keyId: KID } as Dict),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: { claim: "confirmation" },
    });

    // The CONTROL: a REAL thumbprint alongside the same key id still fails closed
    // at the COSE guard, which is the behaviour the null member was slipping past.
    await expect(mint("cwt", { thumbprint: JKT, keyId: KID })).rejects.toMatchObject({
      name: "CoseError",
      code: "cose_cnf_unsupported",
      data: { members: ["jkt"] },
    });
  });

  test("a confirmation that is not an object is refused, and a null one is not stated", async () => {
    // The claim-level twin of the member rule above, on the READ side — the door
    // a stranger's token arrives at. A scalar `cnf` is a binding this package
    // cannot describe, and reporting the token as unbound would report a
    // declaration its issuer signed as never made. `cnf: null` is the opposite:
    // no declaration was made, so none is reported.
    expect(() => Aegis.toDomain({ cnf: "not-a-confirmation" } as Dict)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "confirmation",
          invalid: [
            { key: "confirmation", message: 'Claim "confirmation" must be an object' },
          ],
        },
      }) as unknown as Error,
    );

    expect(Aegis.toDomain({ cnf: null } as Dict).claims.confirmation).toBeUndefined();
  });
});

import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { CBOR_TAG, inspectToken } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { coseWireKey } from "../header/header-registry.js";
import type { TokenType } from "../../constants/token-type.js";
import type { ClaimsTokenFormat } from "../../types/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * `signToken` — the whole `aegis.sign` verb, beside this file.
 *
 * The verb takes DOMAIN claims and emits the wire's own vocabulary, so the same
 * call produces a JOSE `sub` or an RFC 8392 §3 integer label depending only on
 * the format asked for.
 *
 * ⚠ EVERY WIRE CLAIM HERE IS READ WITH THE INDEPENDENT INSPECTOR, never off the
 * returned `format` field. A `format` is aegis describing itself; the dot count
 * and the CBOR tag chain are what a foreign reader actually sees, and the two
 * disagreeing is the defect this suite exists to catch.
 */
describe("aegis.sign", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  // The inspector reports a JOSE bucket as a name-keyed object and a COSE one as
  // a raw label `Map` — deliberately, since `2` and `"2"` are different COSE
  // labels (RFC 9052 §1.5). Flattening the Map preserves which one the decoder
  // produced, so an integer key stays an integer key here.
  const asDict = (bucket: unknown): Dict =>
    bucket instanceof Map ? (Object.fromEntries(bucket) as Dict) : (bucket as Dict);

  // A COSE_Mac0 (RFC 9052 §6.2) is the one claims format that takes a shared
  // secret.
  const keyFor = (format: ClaimsTokenFormat): typeof TEST_EC_KEY_SIG =>
    format === "cwm" ? TEST_OCT_KEY_SIG : TEST_EC_KEY_SIG;

  const readablePayload = (token: string): unknown => {
    const read = inspectToken(token).payload;

    if (read.readable === true) return read.value;

    throw new Error(`unreadable payload: ${read.reason}`);
  };

  const wirePayload = async (
    format: ClaimsTokenFormat,
    payload: Dict,
    tokenType?: TokenType,
  ): Promise<Dict> => {
    const signed = await aegis.sign({
      format,
      payload,
      tokenType,
      key: { kryptos: keyFor(format) },
    });

    return asDict(readablePayload(signed.token));
  };

  const wireHeader = async (
    format: ClaimsTokenFormat,
    tokenType: TokenType,
  ): Promise<Dict> => {
    const signed = await aegis.sign({
      format,
      payload: { subject: "u1" },
      tokenType,
      key: { kryptos: keyFor(format) },
    });

    return asDict(inspectToken(signed.token).protectedHeader);
  };

  /**
   * EVERY FORMAT THE VERB ACCEPTS, each proved to be the wire it names — read off
   * the BYTES, so a `format` field and the token cannot disagree unnoticed.
   *
   * `cwm` is the COSE_Mac0 twin of `cwt` and takes a SYMMETRIC key
   * (RFC 9052 §6.2); `cwt` signs a COSE_Sign1 (RFC 9052 §4.2). Both are framed by
   * the CWT tag (RFC 8392 §9.4).
   */
  test.each([
    ["jwt", "jose", 3, undefined],
    ["cwt", "cose", undefined, CBOR_TAG.sign1],
    ["cwm", "cose", undefined, CBOR_TAG.mac0],
  ] as const)(
    "%s is signed as a real %s token",
    async (format, expectedWire, partCount, structureTag) => {
      const signed = await aegis.sign({
        format,
        payload: { subject: "u1" },
        key: { kryptos: keyFor(format) },
      });

      expect(signed.format).toBe(format);

      const inspected = inspectToken(signed.token);

      expect(inspected.wire).toBe(expectedWire);

      if (inspected.wire === "jose") {
        expect(inspected.partCount).toBe(partCount);
      } else {
        expect(inspected.tags).toEqual([CBOR_TAG.cwt, structureTag]);
      }
    },
  );

  /**
   * ⭐ THE DEFAULT IS `jwt`, the same default `ProfileMintOptions.format` applies.
   *
   * The two verbs differing here would be a footgun rather than a convenience:
   * `sign({ payload })` and `mint(profile, content)` would emit different wires
   * from the same-looking call.
   */
  test("an unstated format signs a JWT", async () => {
    const signed = await aegis.sign({
      payload: { subject: "u1" },
      key: { kryptos: TEST_EC_KEY_SIG },
    });

    expect(signed.format).toBe("jwt");

    const inspected = inspectToken(signed.token);

    expect(inspected.wire).toBe("jose");
    expect(inspected.payload).toEqual({ readable: true, value: { sub: "u1" } });
  });

  /**
   * ⭐ THE PAYLOAD IS A CLAIM SET UNCONDITIONALLY — there is no second door for
   * the default to disagree with. Stating the format and omitting it put the same
   * claims on the same wire under the same registered keys.
   */
  test("stating the default format changes nothing about the payload", async () => {
    const stated = await aegis.sign({
      format: "jwt",
      payload: { subject: "u1" },
      key: { kryptos: TEST_EC_KEY_SIG },
    });
    const unstated = await aegis.sign({
      payload: { subject: "u1" },
      key: { kryptos: TEST_EC_KEY_SIG },
    });

    expect(inspectToken(stated.token).payload).toEqual(
      inspectToken(unstated.token).payload,
    );
  });

  /**
   * ⭐ THE DOMAIN → WIRE TRANSLATION, at the byte level, on both wires.
   *
   * One domain payload has to reach two different keyings — RFC 7519 §4.1.2 and
   * RFC 8392 §3.1.2 for the subject, RFC 7519 §4.1.7 and RFC 8392 §3.1.7 for the
   * token id — which is why this verb takes a format instead of making the caller
   * pick a wire namespace.
   */
  test("a JOSE claims token carries the registered JOSE claim NAMES", async () => {
    await expect(
      wirePayload("jwt", { subject: "u1", tokenId: "tid", clientId: "c1" }),
    ).resolves.toEqual({ sub: "u1", jti: "tid", client_id: "c1" });
  });

  test("a COSE claims token carries the registered integer LABELS", async () => {
    const payload = await wirePayload("cwt", {
      subject: "u1",
      tokenId: "tid",
      clientId: "c1",
    });

    // Integer keys, not the text names — `2` and `"2"` are different COSE labels
    // (RFC 9052 §1.5), and `Object.fromEntries` above preserves which one the
    // decoder produced.
    expect(payload).toEqual({
      2: "u1",
      // The id travels as bytes — RFC 8392 §3.1.7.
      7: Buffer.from("tid"),
      // No registered label exists for `client_id`, so it keeps its text key.
      client_id: "c1",
    });
  });

  test("the COSE_Mac0 twin keys its claims identically", async () => {
    // The STRUCTURE differs (RFC 9052 §6.2 vs RFC 9052 §4.2); the keying does not.
    await expect(wirePayload("cwm", { subject: "u1", tokenId: "tid" })).resolves.toEqual({
      2: "u1",
      7: Buffer.from("tid"),
    });
  });

  /**
   * ⭐ NO PROFILE FLOOR — the ONE thing that separates this verb from `mint`.
   *
   * `mint` assembles an envelope (`assemble-common-claims.ts`) and enforces the
   * profile's policy (`enforce-policy.ts`); neither runs here, so the token says
   * exactly what the caller said and no more. A generated `iat`/`jti`, a
   * deployment `iss` or a lifetime-derived `exp` appearing here would mean a
   * floor had leaked into the profile-less verb.
   */
  test.each(["jwt", "cwt"] as const)(
    "%s adds no claim the caller did not state",
    async (format) => {
      const payload = await wirePayload(format, { subject: "u1" });

      expect(Object.keys(payload)).toEqual([format === "jwt" ? "sub" : "2"]);
    },
  );

  test("no profile policy is enforced — a bare claim set signs", async () => {
    // `access_token` REQUIRES an audience and a client id; `mint` refuses this
    // content (`Aegis.test.ts` pins that). The profile-less verb has no such
    // floor to apply, which is the whole difference between the two verbs.
    await expect(
      aegis.sign({
        format: "jwt",
        payload: { subject: "u1" },
        tokenType: "access_token",
        key: { kryptos: TEST_EC_KEY_SIG },
      }),
    ).resolves.toMatchObject({ format: "jwt" });

    await expect(
      aegis.mint("access_token", { subject: "u1" } as never),
    ).rejects.toThrow();
  });

  /**
   * ⭐ SIGN AND MINT REACH THE SAME SEAM, measured rather than asserted: take the
   * claims a MINT produced, read them back in DOMAIN terms, and hand those to
   * `sign`. Both wires then carry the identical claim set under the identical
   * keys — so the domain → wire translation below `wire.signClaims` is one
   * implementation, and everything `mint` has that this does not is what it put
   * INTO the domain bag, never how the bag was written to the wire.
   */
  test.each(["jwt", "cwt"] as const)(
    "%s writes a mint's own claims to the same wire keys",
    async (format) => {
      const minted = await aegis.mint(
        "access_token",
        { subject: "u1", audience: ["rs"], clientId: "c1" } as never,
        { format, sign: { key: { kryptos: TEST_EC_KEY_SIG } } } as never,
      );

      const mintedPayload = readablePayload(minted.token);

      const signedPayload = await wirePayload(
        format,
        aegis.parse(minted.token).claims,
        "access_token",
      );

      expect(signedPayload).toEqual(asDict(mintedPayload));
    },
  );

  test.each(["jwt", "cwt"] as const)(
    "%s stamps the caller's token type with the mint's own derivation",
    async (format) => {
      const minted = await aegis.mint(
        "access_token",
        { subject: "u1", audience: ["rs"], clientId: "c1" } as never,
        { format, sign: { key: { kryptos: TEST_EC_KEY_SIG } } } as never,
      );

      const mintedHeader = asDict(inspectToken(minted.token).protectedHeader);

      // Label 16 on COSE (RFC 9596), `typ` on JOSE — the same media type reached
      // from a profile there and from the content's own token type here.
      const typKey = format === "jwt" ? "typ" : "16";

      await expect(wireHeader(format, "access_token")).resolves.toMatchObject({
        [typKey]: mintedHeader[typKey],
      });
    },
  );

  /**
   * ⭐ A TOKEN TYPE WHOSE SHORT NAME IS THE BARE CONVENTIONAL FORM, on every
   * format the verb emits.
   *
   * `id_token` maps to `JWT` (OIDC Core §2), so there is no prefix and each kit
   * stamps its own bare form: `JWT` on JOSE, `application/cwt` on a CWT or CWM,
   * `application/cws` on a CWS. ⚠ A derivation answering the JOSE spelling for a
   * COSE write does not merely mis-stamp the header — the value is not a
   * representable COSE typ, so the call throws and no token is produced.
   */
  test.each([
    ["jwt", "typ", "JWT"],
    ["cwt", 16, "application/cwt"],
    ["cwm", 16, "application/cwt"],
  ] as const)(
    "%s stamps its own bare form for a type with no structured spelling",
    async (format, key, expected) => {
      await expect(wireHeader(format, "id_token")).resolves.toMatchObject({
        [key]: expected,
      });
    },
  );

  /**
   * The caller's explicit `typ` OVERRIDES the `tokenType`-derived value, on both
   * wires. It is stated in the JOSE spelling either way — the kit re-wraps the
   * PREFIX in its own format, so `at+jwt` on a COSE write emits
   * `application/at+cwt` (the same `+jwt` → `+cwt` rewrite a profile's mandated
   * type goes through).
   *
   * ⚠ Neither `typ` nor the `proprietary` row below is a profile floor, so
   * withholding either from `sign` would make the two verbs differ by something
   * other than the floor.
   */
  test.each([
    ["jwt", "typ", "application/custom+jwt"],
    ["cwt", 16, "application/custom+cwt"],
    // The COSE_Mac0 twin takes the same derivation — RFC 9052 §6.2 differs in
    // STRUCTURE, not in how the type header is spelled.
    ["cwm", 16, "application/custom+cwt"],
  ] as const)(
    "%s honours an explicit typ over the token type",
    async (format, key, expected) => {
      const signed = await aegis.sign({
        format,
        payload: { subject: "u1" },
        tokenType: "access_token",
        typ: "custom+jwt",
        key: { kryptos: keyFor(format) },
      });

      expect(asDict(inspectToken(signed.token).protectedHeader)).toMatchObject({
        [key]: expected,
      });
    },
  );

  /**
   * `proprietary` selects the lindorm private-use COSE labels over the
   * interoperable spelling. It reaches the wire on `sign` exactly as it does on
   * `mint`: `objectId` has no IANA COSE parameter, so the interoperable default
   * writes it under the string label `"oid"` and `proprietary: true` writes it at
   * the private-use INTEGER label instead. Nothing is added or dropped either
   * way, so the row asserts the same value at each of the two keys and its
   * ABSENCE at the other — the pair is what distinguishes "moved" from "written
   * somewhere as well".
   */
  test("proprietary chooses how a private-use COSE parameter is keyed", async () => {
    const interoperable = await aegis.sign({
      format: "cwt",
      payload: { subject: "u1" },
      header: { objectId: "obj-1" },
      key: { kryptos: TEST_EC_KEY_SIG },
    });

    const compact = await aegis.sign({
      format: "cwt",
      payload: { subject: "u1" },
      header: { objectId: "obj-1" },
      proprietary: true,
      key: { kryptos: TEST_EC_KEY_SIG },
    });

    const interoperableHeader = asDict(inspectToken(interoperable.token).protectedHeader);
    const compactHeader = asDict(inspectToken(compact.token).protectedHeader);

    // Both keys come from `coseWireKey`, the resolver the WRITER itself uses, so
    // a re-numbering of the private-use label moves this row with the code
    // instead of leaving it asserting a stale one.
    const interoperableKey = coseWireKey("oid", false);
    const compactKey = coseWireKey("oid", true);

    expect(interoperableKey).toBe("oid");
    expect(compactKey).not.toBe(interoperableKey);

    // Asserted AT the resolved key, in both directions. `toContain` over the
    // header's VALUES would pass for a parameter written at any label at all —
    // including a reserved one it must never land on.
    expect(interoperableHeader).toMatchObject({ [interoperableKey]: "obj-1" });
    expect(interoperableHeader).not.toHaveProperty(String(compactKey));

    expect(compactHeader).toMatchObject({ [compactKey]: "obj-1" });
    expect(compactHeader).not.toHaveProperty(String(interoperableKey));
  });
});

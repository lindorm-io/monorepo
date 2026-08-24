import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { inspectToken } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * `encryptOuter` — the sign-then-encrypt composition, written ONCE for both
 * wires, and the one thing it is still allowed to disagree about: whether the
 * encrypting OUTER carries the inner token's type.
 *
 * ⚠ The divergence is PRESERVED, NOT DESIGNED. The mint hands the same profile
 * prefix to both wires; the COSE outer stamps it and the JOSE outer does not.
 * Until the composition was shared it lived in a hand-written destructure that
 * simply did not name the field, which is exactly why nothing noticed — and it is
 * now `TokenWire.nestedTokenTyp`, a one-line switch that silently changes an
 * emitted header on every encrypted mint. A named switch nobody watches is worse
 * than the omission it replaced, so this drives both wires and pins both answers.
 *
 * ⚠ The wire corpus cannot see it. Its only encrypted mints are `id_token`, whose
 * typ is the BARE conventional form and so reduces to NO prefix at all — both
 * wires agree there whatever the switch says. A profile with a structured media
 * type is the only case where the two answers differ, so this registers one.
 */
describe("encryptOuter — the type the encrypting outer declares", () => {
  let aegis: Aegis;

  const CONTENT = { subject: "user-1", audience: ["https://resource.lindorm.io/"] };

  /** The COSE protected header value at label 16 (`typ`, RFC 9596), or `undefined`. */
  const coseTyp = (token: string): unknown => {
    const wire = inspectToken(token);
    if (wire.wire !== "cose") throw new Error("expected a COSE token");
    return wire.protectedHeader.get(16);
  };

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });

    aegis = new Aegis({ amphora, logger });

    // An encryptable profile whose typ is a STRUCTURED media type, so it reduces
    // to a real prefix (`resource-token`) on both wires. No policy: the subject
    // of this file is the envelope, not the claim floor.
    aegis.registerProfile({
      name: "resource_token",
      typ: { presence: "required", value: "application/resource-token+jwt" },
      policy: [],
      autoInject: ["issuedAt", "issuer"],
      issuer: "platform",
      lifetime: "1h",
      encryptable: true,
    });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_OCT_KEY_ENC);
  });

  // Without this the JOSE result below would read as "there was no type to
  // carry", which is a different statement entirely.
  test("the signed inner carries the profile's structured type on BOTH wires", async () => {
    const jose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "jwt",
      } as never,
    );
    const cose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "cwt",
      } as never,
    );

    expect(inspectToken(jose.token).protectedHeader).toMatchObject({
      typ: "application/resource-token+jwt",
    });
    expect(coseTyp(cose.token)).toBe("application/resource-token+cwt");
  });

  test("the COSE outer carries that type; the JOSE outer drops it", async () => {
    const jose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "jwt",
        encrypt: {},
      } as never,
    );
    const cose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "cwt",
        encrypt: {},
      } as never,
    );

    // The signed token keeps its own kind through the wrapping; the envelope is
    // reported beside it.
    expect(jose.format).toBe("jwt");
    expect(jose.wrapper).toBe("jwe");
    expect(cose.format).toBe("cwt");
    expect(cose.wrapper).toBe("cwe");

    // ⚠ The bare conventional form: the prefix the inner carries did not travel.
    expect(inspectToken(jose.token).protectedHeader).toMatchObject({ typ: "JWE" });

    expect(coseTyp(cose.token)).toBe("application/resource-token+cwe");
  });

  /**
   * ⭐ THE PRECEDENCE, and the COSE half is the only thing that can state it. A
   * caller's `encrypt.tokenType` describes the ENVELOPE, so it beats the wire's
   * own answer — and on JOSE the wire's answer is `undefined`, which means either
   * ordering of the two would produce the caller's value there. Only a wire that
   * HAS a fallback can tell "caller wins" from "wire wins", so the assertion that
   * carries this rule is the COSE one, on a profile whose inner type is a real
   * prefix rather than the bare form. RFC 9596 §2.
   */
  test("a stated envelope type beats the type the wire would carry", async () => {
    const cose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "cwt",
        encrypt: { tokenType: "override" },
      } as never,
    );
    const jose = await aegis.mint(
      "resource_token",
      CONTENT as never,
      {
        format: "jwt",
        encrypt: { tokenType: "override" },
      } as never,
    );

    // NOT `application/resource-token+cwe` — the inner's prefix is what this wire
    // carries when the caller states nothing, and it is stated here.
    expect(coseTyp(cose.token)).toBe("application/override+cwe");
    expect(inspectToken(jose.token).protectedHeader).toMatchObject({
      typ: "application/override+jwe",
    });
  });
});

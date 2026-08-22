import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { CweKit } from "../../classes/CweKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { encodeCbor } from "../cose/cbor.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * `aegis.decrypt` — what it REFUSES, on both wires and on input that is no token
 * at all.
 *
 * The verb asks the ONE detector every other read verb asks, so `verify`, `parse`
 * and `decrypt` cannot disagree about what a token IS. The refusal is the only
 * externally visible half of that, so it is pinned here rather than left to the
 * round trips.
 *
 * ⚠ A verb sniffing for itself reaches `decodeCbor` directly, and a string that
 * is not a token at all then raises `CoseError: Failed to decode CBOR` — a
 * decoder complaint about input the caller never claimed was CBOR — instead of
 * the refusal this verb documents.
 */
describe("aegis.decrypt — the refusal", () => {
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
    amphora.add(TEST_OCT_KEY_ENC);
  });

  const codeOf = async (token: string): Promise<unknown> => {
    try {
      await aegis.decrypt(token);
    } catch (error) {
      return (error as { code?: string }).code;
    }

    throw new Error("expected a refusal");
  };

  test.each(["jwt", "cwt"] as const)(
    "a signed %s claims token is refused — decrypt is not a general reader",
    async (format) => {
      const { token } = await aegis.mint(
        "id_token",
        { subject: "user-1", audience: ["client-1"] } as never,
        { format, context: { accessTokenIssued: false } } as never,
      );

      await expect(codeOf(token)).resolves.toBe("decrypt_requires_encrypted");
    },
  );

  test("an opaque signed token is refused", async () => {
    const { token } = await aegis.sign({ payload: { kept: "yes" } });

    await expect(codeOf(token)).resolves.toBe("decrypt_requires_encrypted");
  });

  test.each(["not-a-token", "a.b.c", ""])(
    "%s is refused as a domain error, never as a decoder complaint",
    async (token) => {
      await expect(codeOf(token)).resolves.toBe("decrypt_requires_encrypted");
    },
  );

  test.each(["jwe", "cwe"] as const)("an encrypted %s is accepted", async (format) => {
    const { token } = await aegis.encrypt({ subject: "user-1" }, { format });
    const decrypted = await aegis.decrypt(token);

    expect(decrypted.format).toBe(format);
    expect(decrypted.payload).toEqual({ subject: "user-1" });
  });
});

/**
 * ⚠ WHY `DecryptedToken.payload` IS THE FULL `TokenContent` AND NOT
 * `Buffer | string`.
 *
 * The plaintext is reconstructed from the outer's own `cty`, which is the
 * PRODUCER's to choose — and a producer aegis did not write may state any
 * registered media type on either wire (`application/json`, RFC 8259 §11;
 * `application/cbor`, RFC 8949 §9.3). Both reconstruct to a STRUCTURED value, so
 * `aegis.decrypt` — which reads any encrypted token, foreign ones included — can
 * hand a caller an object. The field's type says so instead of a cast asserting
 * it cannot happen.
 *
 * These two rows also pin the cross-wire pair: neither media type is special to
 * the wire it arrives on, because no wire keeps a cty to itself any more.
 */
describe("aegis.decrypt — a foreign token stating the OTHER wire's cty", () => {
  let aegis: Aegis;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
    amphora.add(TEST_OCT_KEY_ENC);
  });

  test("a JWE declaring application/cbor reconstructs a Dict", async () => {
    // The kit is driven DIRECTLY, because no aegis door writes this token: the
    // JOSE wire infers `application/json` from a Dict and octet/text from bytes
    // or a string. A caller `cty` wins as the wire label, which is how another
    // producer states a CBOR body.
    const token = new JweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).encrypt(
      encodeCbor({ tenant: "acme" }),
      { header: { cty: "application/cbor" } },
    );

    const decrypted = await aegis.decrypt(token);

    expect(decrypted.contentType).toBe("application/cbor");
    expect(decrypted.payload).toEqual({ tenant: "acme" });
  });

  test("a COSE_Encrypt0 declaring application/json reconstructs a Dict", async () => {
    const token = new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).encrypt(
      Buffer.from(JSON.stringify({ tenant: "acme" }), "utf8"),
      { header: { cty: "application/json" } },
    );

    const decrypted = await aegis.decrypt(token.toString("base64url"));

    expect(decrypted.contentType).toBe("application/json");
    expect(decrypted.payload).toEqual({ tenant: "acme" });
  });
});

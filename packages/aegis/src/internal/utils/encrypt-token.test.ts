import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { inspectToken, type CoseInspection } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/** RFC 9052 §3.1, Table 3 — the two protected labels this suite is about. */
const CTY = 3;
const TYP = 16;

/**
 * WHAT THE `cwe` ENVELOPE DECLARES ABOUT ITS PLAINTEXT, AND ON WHICH PARAMETER.
 *
 * `aegis.encrypt` seals the caller's own value and gives that value back — there
 * is no claims layer and nothing to discriminate — so `cty` (label 3, which
 * RFC 9052 §3.1 defines as the "Content type of the payload") has exactly one
 * job left: say what the bytes ARE, so the reader reconstructs the same JS type.
 * `typ` (label 16) stays free for the caller's routing type, which is the split
 * RFC 9596 draws — `typ` "declare[s] the type of this complete COSE object, as
 * compared to the content type header parameter, which declares the type of the
 * COSE object payload" — and the same one JOSE draws in RFC 7515 §4.1.9 vs
 * §4.1.10.
 *
 * ⚠ These rows are the ONLY thing pinning either declaration to the wire, and
 * they read it with an INDEPENDENT inspector (raw `cbor2`, nothing from
 * `src/internal/`). Two invented markers have already had to be deleted from this
 * area — a reserved `typ` value of `application/claims+cwe` (whose `+cwe` suffix
 * is not registered under RFC 6838 at all) and, after it, a `cty` of
 * `application/cbor` that meant "claims" only by our own private convention. Both
 * survived because a writer and a reader agreed with each other privately and
 * nothing in the suite read the bytes.
 */
describe("aegis.encrypt — the cwe envelope declares its own plaintext", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  const OBJECT = { subject: "user-1", audience: [ISSUER], tenant: "acme" };
  const BYTES = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

  const protectedOf = async (token: string): Promise<ReadonlyMap<unknown, unknown>> => {
    const inspection = inspectToken(token) as CoseInspection;
    expect(inspection.wire).toBe("cose");
    return inspection.protectedHeader;
  };

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_ENC);
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("an object", () => {
    test("declares application/json — the honest description of its bytes", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format: "cwe" });

      // RFC 8259 §11 registers `application/json` for exactly these bytes, and
      // these bytes ARE JSON: the shared codec's structured family is `json` on
      // every door of both wires, so a Dict is a Dict in and a Dict out.
      expect((await protectedOf(token)).get(CTY)).toBe("application/json");
    });

    test("declares NO invented claims marker on typ", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format: "cwe" });
      const wire = await protectedOf(token);

      // The bare conventional form for this format, and nothing else. In
      // particular NOT `application/claims+cwe`: `+cwe` is not a registered
      // RFC 6838 structured syntax suffix, and a claims marker is a statement
      // about the payload, which is not what `typ` is for.
      expect(wire.get(TYP)).toBe("application/cwe");
      expect(JSON.stringify([...wire.values()])).not.toContain("claims");
    });

    test("carries the caller's type on typ, which the marker used to displace", async () => {
      const { token } = await aegis.encrypt(OBJECT, {
        format: "cwe",
        type: "access_token",
      });
      const wire = await protectedOf(token);

      expect(wire.get(TYP)).toBe("application/at+cwe");
      expect(wire.get(CTY)).toBe("application/json");
    });

    test("decrypt reads it back as the object it was given", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format: "cwe" });
      const result = await aegis.decrypt(token);

      expect(result.format).toBe("cwe");
      expect(result.payload).toEqual(OBJECT);
      // …and it reports the declaration it reconstructed by.
      expect(result.contentType).toBe("application/json");
    });
  });

  describe("an opaque payload", () => {
    test("declares application/octet-stream on cty", async () => {
      const { token } = await aegis.encrypt(BYTES, { format: "cwe" });

      expect((await protectedOf(token)).get(CTY)).toBe("application/octet-stream");
    });

    test("decrypt returns the bytes VERBATIM", async () => {
      const { token } = await aegis.encrypt(BYTES, { format: "cwe" });
      const result = await aegis.decrypt(token);

      expect(result.payload).toEqual(BYTES);
      expect(result.contentType).toBe("application/octet-stream");
    });

    test("a string declares text/plain and returns as a string", async () => {
      const { token } = await aegis.encrypt("session-state", { format: "cwe" });

      expect((await protectedOf(token)).get(CTY)).toBe("text/plain");
      expect((await aegis.decrypt(token)).payload).toBe("session-state");
    });
  });

  /**
   * ⚠ THE DISCRIMINANT IS GONE, AND ITS ABSENCE IS THE RULE NOW.
   *
   * A claim-SHAPED object and any other object declare the SAME thing and are
   * read back the same way, because the envelope makes no claim about meaning.
   * The pair used to differ — `application/cbor` for the "claims" door,
   * `application/json` for the opaque one — and the difference is what let a
   * decrypt promote `{ iss: … }` to a domain issuer its author never asserted.
   */
  describe("no plaintext is privileged over another", () => {
    test("a claim-shaped object and an arbitrary one declare the same cty", async () => {
      const claimShaped = await aegis.encrypt(
        { subject: "user-1", audience: [ISSUER] },
        { format: "cwe" },
      );
      const arbitrary = await aegis.encrypt({ tenant: "acme" }, { format: "cwe" });

      expect((await protectedOf(claimShaped.token)).get(CTY)).toBe(
        (await protectedOf(arbitrary.token)).get(CTY),
      );
    });

    test("keys that SPELL registered claims stay the caller's own keys", async () => {
      // `iss`/`sub` are RFC 8392's registered CWT claims (integer labels 1 and
      // 2). Nothing about an object that happens to use those keys says its
      // author asserted them, so they must survive as text.
      const { token } = await aegis.encrypt(
        { iss: "not-an-issuer", sub: "not-a-subject" },
        { format: "cwe" },
      );

      expect((await aegis.decrypt(token)).payload).toEqual({
        iss: "not-an-issuer",
        sub: "not-a-subject",
      });
    });

    test("an EMPTY member spelled like a registered claim survives too", async () => {
      // The door decides, not the payload's JS type. `nonce` is a declared claim
      // whose registry cell prunes an empty value — on the CLAIMS doors, where an
      // issuer asserts claims to an audience. This door asserts nothing: it seals
      // a value and hands that exact value back, so an empty member is part of
      // the value. The loss is silent and the caller cannot compensate for it —
      // the token decrypts cleanly and the member is simply gone.
      const { token } = await aegis.encrypt({ nonce: "", kept: "x" }, { format: "cwe" });

      expect((await aegis.decrypt(token)).payload).toEqual({ nonce: "", kept: "x" });
    });
  });

  /**
   * The ONE statement `aegis.encrypt` makes about its payload: when the payload
   * IS a token, the outer declares the nesting. RFC 8392 §9.2 registers
   * `application/cwt`, and a reader that did not see it would reconstruct the
   * plaintext as an octet blob rather than as the token it is.
   */
  describe("a nested token", () => {
    test("declares application/cwt when handed a CWT", async () => {
      const signed = await aegis.cwt.sign({ subject: "user-1", issuer: ISSUER });
      const { token } = await aegis.encrypt(signed.token, { format: "cwe" });

      expect((await protectedOf(token)).get(CTY)).toBe("application/cwt");
    });

    test("a caller's own content type still wins", async () => {
      const signed = await aegis.cwt.sign({ subject: "user-1", issuer: ISSUER });
      const { token } = await aegis.encrypt(signed.token, {
        format: "cwe",
        header: { contentType: "application/example" },
      });

      expect((await protectedOf(token)).get(CTY)).toBe("application/example");
    });
  });
});

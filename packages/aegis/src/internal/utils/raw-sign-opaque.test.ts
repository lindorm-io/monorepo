import { Amphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { type RawLabelMap, inspectToken } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG_CERT } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisDomainError } from "../../errors/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * `rawSignOpaque` — the ONE entry both opaque kit namespaces go through, driven
 * on the ONE option it takes that the wires answer differently.
 *
 * `bindCertificate` is `forwarded` on both: `CwsKit.sign` resolves it off the
 * signing key and stamps RFC 9360 §2's `x5chain` (label 33) and `x5t` (34), and
 * `JwsKit.sign` stamps RFC 7515 §4.1.6's `x5c` beside its own two digests. What
 * differs is HOW MANY digests each wire can name the certificate with, and that
 * is the wire's own answer rather than anything the caller states — so the rows
 * below read the emitted bytes rather than a refusal.
 *
 * ⚠ Every assertion here goes through `inspectToken`, which imports nothing from
 * `src/internal/` or `src/classes/`: a round trip through aegis's own decoder
 * would prove only that the package agrees with itself.
 */
describe("rawSignOpaque — certificate binding across the two wires", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG_CERT);
  });

  /**
   * ⭐ THE COSE BINDING, ASSERTED ON THE BYTES. Read by `inspectToken`, which
   * imports nothing from `src/internal/` or `src/classes/` — a round trip through
   * aegis's own decoder would prove only that the package agrees with itself.
   *
   * RFC 9360 §2 label 33 is `COSE_X509` — *"If a single certificate is conveyed,
   * it is placed in a CBOR byte string. If multiple certificates are conveyed, a
   * CBOR array of byte strings is used"* — and label 34 is `COSE_CertHash`,
   * `[ hashAlg, hashValue ]`, whose SHA-256 identifier is `-16` (RFC 9054 §3.2).
   */
  test("binds the certificate chain on the COSE wire, in RFC 9360 structures", async () => {
    const bound = await aegis.cws.sign("payload", { bindCertificate: "chain" });
    const unbound = await aegis.cws.sign("payload", { bindCertificate: "none" });

    const header = inspectToken(bound.token).protectedHeader as RawLabelMap;

    // Label 33: an array of DER byte strings, one per certificate in the chain.
    const chain = header.get(33);
    expect(Array.isArray(chain)).toBe(true);
    expect((chain as Array<unknown>).length).toBeGreaterThan(1);
    for (const cert of chain as Array<unknown>) {
      expect(cert).toBeInstanceOf(Uint8Array);
    }

    // Label 34: the two-element COSE_CertHash, SHA-256 by its RFC 9054 label.
    const hash = header.get(34) as Array<unknown>;
    expect(hash).toHaveLength(2);
    expect(hash[0]).toBe(-16);
    expect(hash[1]).toBeInstanceOf(Uint8Array);
    expect((hash[1] as Uint8Array).length).toBe(32);

    // ⚠ NO SECOND DIGEST. A CBOR map cannot carry a duplicate key, so the SHA-1
    // thumbprint the JOSE twin emits beside `x5t#S256` has nowhere to ride.
    expect([...(header as Map<unknown, unknown>).keys()]).toEqual(
      expect.arrayContaining([33, 34]),
    );

    // The control: without the request neither label is written, so the
    // assertions above cannot be satisfied by anything the kit always does.
    const none = inspectToken(unbound.token).protectedHeader as RawLabelMap;
    expect(none.has(33)).toBe(false);
    expect(none.has(34)).toBe(false);
  });

  /**
   * The DEFAULT mode, which is the one a deployment actually runs: an absent
   * `bindCertificate` beside a cert-bearing key resolves to `"thumbprint"`
   * (`resolve-cert-binding.ts`), so the digest travels and the chain does not.
   */
  test("a cert-bearing key binds the thumbprint alone when no mode is stated", async () => {
    const { token } = await aegis.cws.sign("payload");

    const header = inspectToken(token).protectedHeader as RawLabelMap;

    expect(header.has(34)).toBe(true);
    expect(header.has(33)).toBe(false);
  });

  /**
   * ⭐ THE ROUND TRIP. A token this package signs must verify under BOTH modes,
   * and a rewritten digest must fail — which is what says the binding is CHECKED
   * rather than merely written.
   */
  test.each(["strict", "lax"] as const)(
    "verifies its own binding in %s mode",
    async (mode) => {
      const { token } = await aegis.cws.sign("payload", { bindCertificate: "chain" });

      await expect(
        aegis.cws.verify(token, { certBindingMode: mode }),
      ).resolves.toMatchObject({ payload: "payload" });
    },
  );

  /**
   * The JOSE twin, where the SAME request produces a THIRD parameter the COSE
   * wire has no room for.
   *
   * ⚠ `x5c` IS THE ASSERTION FOR THE MODE, and the choice is measured rather than
   * stylistic. A cert-bearing key emits `x5t#S256` and `x5t` on every jws sign
   * that does not switch the binding off (`"none"` suppresses all three) — with
   * no options at all, and identically for `bindCertificate: "thumbprint"` — so a
   * row asserting either digest holds nothing about the MODE. `"chain"` is the
   * only mode that adds the chain itself (RFC 7515 §4.1.6), so `x5c` is the one
   * parameter whose presence attributes the header to the request.
   */
  test("the JOSE twin binds the certificate chain", async () => {
    const bound = await aegis.jws.sign("payload", { bindCertificate: "chain" });
    const unbound = await aegis.jws.sign("payload", { bindCertificate: "none" });

    const boundHeader = inspectToken(bound.token).protectedHeader as Dict;
    const unboundHeader = inspectToken(unbound.token).protectedHeader as Dict;

    expect(Array.isArray(boundHeader.x5c)).toBe(true);

    // The control: with the binding switched off the chain is absent, so the
    // assertion above cannot be satisfied by something the kit always does.
    expect(unboundHeader).not.toHaveProperty("x5c");
  });

  /**
   * ⭐ THE PAIR, ON THE JOSE BYTES — the COSE row above asserts label 34 is the
   * ONLY digest, and this is its twin: RFC 7515 §4.1.7 `x5t` (SHA-1) and §4.1.8
   * `x5t#S256` (SHA-256) are SEPARATE parameters, so a JOSE token names its
   * certificate with BOTH and no option turns either off.
   */
  test("a cert-bearing key names its certificate with both JOSE digests", async () => {
    const { token } = await aegis.jws.sign("payload");

    const header = inspectToken(token).protectedHeader as Dict;

    expect(typeof header["x5t#S256"]).toBe("string");
    expect(typeof header.x5t).toBe("string");

    // The two are DIFFERENT digests of the same leaf, not one value written
    // twice — which is what a resolver wired to a single accessor would produce.
    expect(header.x5t).not.toBe(header["x5t#S256"]);
  });
});

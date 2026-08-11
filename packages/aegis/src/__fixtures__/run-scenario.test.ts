import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisKeyError } from "../errors/index.js";
import type { ProfileContent } from "../types/index.js";
import { TEST_EC_KEY_ENC, TEST_OCT_KEY_ENC } from "./keys.js";
import {
  artifactStepOf,
  createScenarioContext,
  DEFAULT_CLOCK,
  readWirePayload,
  runScenario,
  wireOf,
  type ScenarioContext,
} from "./run-scenario.js";
import { CLIENT, ISSUER, NOW, RESOURCE, type Given, type Scenario } from "./scenarios.js";

MockDate.set(new Date(DEFAULT_CLOCK));

/**
 * The INTERPRETER's own tests.
 *
 * `run-scenario.ts` is the step-definition layer, and the conformance table
 * leans on its guards as SAFETY properties: rows are written on the promise that
 * an unreadable payload fails a `wirePayload` assertion instead of satisfying it
 * vacuously, that `absentTwin` is checked against the row's real wire, and that a
 * mis-shaped row is refused rather than half-run. A guard nothing exercises is a
 * promise nobody has read, so the step-definition layer meets the same bar the
 * rows do.
 */
describe("run-scenario — the step-definition layer", () => {
  let ctx: ScenarioContext;

  beforeEach(async () => {
    MockDate.set(new Date(DEFAULT_CLOCK));

    ctx = await createScenarioContext();
    ctx.amphora.add(TEST_EC_KEY_ENC);
    ctx.amphora.add(TEST_OCT_KEY_ENC);
  });

  describe("readWirePayload", () => {
    // The positive case first: without it, every assertion below would also be
    // satisfied by a reader that called everything unreadable.
    test("should read the cleartext payload of a JWT", async () => {
      const { token, format } = await ctx.aegis.jwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        jti: "token-1",
      });

      expect(readWirePayload(token, format)).toMatchObject({
        readable: true,
        payload: { sub: "user-1", jti: "token-1" },
      });
    });

    // A COSE payload comes back COSE-name-keyed — `cti`, not `jti`.
    test("should read the cleartext payload of a CWT, under its COSE names", async () => {
      const { token, format } = await ctx.aegis.cwt.sign({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        exp: NOW + 3600,
        iat: NOW,
        cti: "token-1",
      });

      expect(readWirePayload(token, format)).toMatchObject({
        readable: true,
        payload: { sub: "user-1", cti: "token-1" },
      });
    });

    test("should refuse a JWE — its payload is ciphertext", async () => {
      const { token, format } = await ctx.aegis.jwe.encrypt({ hello: "world" });

      expect(format).toBe("jwe");
      expect(readWirePayload(token, format)).toMatchObject({ readable: false });
    });

    // ⚠ THE reason the format is passed in. A CWE is a COSE_Encrypt0 — a
    // three-element array — so it satisfies `decodeCwtWire`'s arity check and its
    // CIPHERTEXT reaches the CBOR decoder. Shape alone cannot tell it apart from a
    // CWT, so the refusal has to come from the DECLARED format, before the bytes
    // are touched.
    test("should refuse a CWE on its declared format, not on its shape", async () => {
      const { token, format } = await ctx.aegis.cwe.encrypt("hello cose");

      expect(format).toBe("cwe");
      expect(readWirePayload(token, format)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("ciphertext"),
      });
    });

    // A 3-part JOSE token is not necessarily a JWT: an opaque JWS carries bytes,
    // not JSON. The harness names that itself rather than letting a raw
    // SyntaxError surface from three frames down.
    test("should refuse an opaque JWS whose payload is not JSON", async () => {
      const { token, format } = await ctx.aegis.jws.sign(Buffer.from("opaque payload"));

      expect(readWirePayload(token, format)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("opaque body"),
      });
    });

    test("should refuse a JOSE token that has the wrong number of parts", () => {
      expect(readWirePayload("aaa.bbb.ccc.ddd.eee", "jwt")).toMatchObject({
        readable: false,
        reason: expect.stringContaining("5-part"),
      });
    });

    test("should refuse an empty token", () => {
      expect(readWirePayload("", undefined)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("COSE structure"),
      });
    });

    // An unknown format must not be read as "not encrypted, therefore readable" —
    // the shape check still runs behind it.
    test("should still refuse an unreadable token when no format is declared", () => {
      expect(readWirePayload("not-a-token", undefined)).toMatchObject({
        readable: false,
        reason: expect.stringContaining("COSE structure"),
      });
    });
  });

  describe("wireOf", () => {
    const probe = (given: Given): Scenario => ({
      id: "probe",
      title: "a probe row, for the wire derivation alone",
      rationale: "not a capability — this row exists only to exercise `wireOf`.",
      given,
      when: [{ step: "parse" }],
      then: [{ step: "accepts" }],
    });

    const MINT_CONTENT = {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: CLIENT,
    } satisfies ProfileContent["access_token"];

    test("should read a claim-only row as JOSE — it has no wire at all", () => {
      expect(wireOf(probe([{ step: "claims", claims: { subject: "user-1" } }]))).toBe(
        "jose",
      );
    });

    test.each([
      ["jwt" as const, "jose" as const],
      ["jws" as const, "jose" as const],
      ["cwt" as const, "cose" as const],
      ["cws" as const, "cose" as const],
    ])("should read a %s kit-sign row as %s", (kit, wire) => {
      expect(
        wireOf(probe([{ step: "token", via: "kit-sign", kit, claims: { a: 1 } }])),
      ).toBe(wire);
    });

    test.each([
      ["jwe" as const, "jose" as const],
      ["cwe" as const, "cose" as const],
    ])("should read a %s kit-encrypt row as %s", (kit, wire) => {
      expect(
        wireOf(probe([{ step: "token", via: "kit-encrypt", kit, data: { a: 1 } }])),
      ).toBe(wire);
    });

    test("should read a mint row from its requested format", () => {
      expect(
        wireOf(
          probe([
            {
              step: "token",
              via: "mint",
              profile: "access_token",
              content: MINT_CONTENT,
              options: { format: "cwt" },
            },
          ]),
        ),
      ).toBe("cose");
    });

    test("should read a mint row with no requested format as JOSE", () => {
      expect(
        wireOf(
          probe([
            {
              step: "token",
              via: "mint",
              profile: "access_token",
              content: MINT_CONTENT,
            },
          ]),
        ),
      ).toBe("jose");
    });

    test.each([
      ["cwe" as const, "cose" as const],
      ["jwe" as const, "jose" as const],
    ])("should read a domain-encrypt row requesting %s as %s", (format, wire) => {
      expect(
        wireOf(
          probe([
            { step: "token", via: "domain-encrypt", data: { a: 1 }, options: { format } },
          ]),
        ),
      ).toBe(wire);
    });

    test("should read a domain-encrypt row with no requested format as JOSE", () => {
      expect(
        wireOf(probe([{ step: "token", via: "domain-encrypt", data: { a: 1 } }])),
      ).toBe("jose");
    });

    // The setup steps sit AHEAD of the artifact, and the wire comes from the
    // artifact — so a row that stocks the vault first must read the same.
    test("should read the wire off the artifact, not off a preceding setup step", () => {
      expect(
        wireOf(
          probe([
            { step: "keys", keys: ["ec-enc"] },
            { step: "clock", at: DEFAULT_CLOCK },
            { step: "token", via: "kit-sign", kit: "cwt", claims: { sub: "user-1" } },
          ]),
        ),
      ).toBe("cose");
    });
  });

  describe("artifactStepOf", () => {
    test("should return the LAST given step", () => {
      const artifact = { step: "claims", claims: { subject: "user-1" } } as const;

      expect(artifactStepOf([{ step: "keys", keys: ["ec-enc"] }, artifact])).toBe(
        artifact,
      );
    });

    // ⚠ LOCAL cast, deliberate: the `Given` tuple type makes this shape
    // unreachable at compile time, which is exactly why the RUNTIME guard behind
    // it is otherwise never executed. A guard that has never run is a guess.
    test("should refuse a given whose last step builds no artifact", () => {
      const given = [{ step: "keys", keys: ["ec-enc"] }] as unknown as Given;

      expect(() => artifactStepOf(given)).toThrow(/must build the artifact/);
    });
  });

  describe("runScenario", () => {
    // `static-assert` operates on a flat claim dict; handed a token it would
    // otherwise assert against `artifact.claims` of a step that has none.
    test("should refuse a static-assert act on a token-producing given", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the static-assert guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          { step: "token", via: "kit-sign", kit: "jws", claims: { hello: "world" } },
        ],
        when: [{ step: "static-assert", assert: { subject: "user-1" } }],
        then: [{ step: "accepts" }],
      };

      await expect(runScenario(scenario, ctx)).rejects.toThrow(
        /static-assert requires a \{ step: "claims" \} GIVEN/,
      );
    });

    // ⚠ The regression the interpreter was written around: a leading `mint` makes
    // the construction the FIRST act, not the only one. A verify that must refuse
    // proves the later act RAN — were it dropped, the row would assert the
    // successful mint and pass.
    test("should run every act after a leading mint", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the multi-act mint path alone",
        rationale: "not a capability — this row exists only to exercise the loop.",
        given: [
          {
            step: "token",
            via: "mint",
            profile: "access_token",
            content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
          },
        ],
        when: [
          { step: "mint" },
          {
            step: "verify",
            profile: "access_token",
            options: { audience: "someone-else" },
          },
        ],
        then: [{ step: "rejects", error: "AegisDomainError" }],
      };

      await expect(runScenario(scenario, ctx)).resolves.toBeUndefined();
    });

    // …and a single-act mint row still behaves exactly as before.
    test("should assert the construction itself when mint is the only act", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the single-act mint path alone",
        rationale: "not a capability — this row exists only to exercise the loop.",
        given: [
          {
            step: "token",
            via: "mint",
            profile: "access_token",
            content: { subject: "user-1", audience: [RESOURCE], clientId: CLIENT },
          },
        ],
        when: [{ step: "mint" }],
        then: [{ step: "accepts", format: "jwt" }],
      };

      await expect(runScenario(scenario, ctx)).resolves.toBeUndefined();
    });

    // ⚠ The other half of that split, and the reason it exists: unless the first
    // act is `mint`, the GIVEN's construction runs OUTSIDE the outcome try/catch,
    // so a SETUP that throws can never be mistaken for the rejection the row
    // expects. The probe is the strongest form of it — the construction throws
    // the EXACT class the row names, so nothing but the split can tell the two
    // apart. It must FAIL (the setup error escapes), not pass.
    test("should fail a rejecting row whose construction, not its act, threw", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the construction/act split alone",
        rationale: "not a capability — this row exists only to exercise the split.",
        given: [
          {
            step: "token",
            via: "kit-sign",
            kit: "jwt",
            claims: {
              iss: ISSUER,
              sub: "user-1",
              aud: [RESOURCE],
              exp: NOW + 3600,
              iat: NOW,
              jti: "token-1",
            },
            // The vault holds no RS256 key, so the SIGN cannot resolve one and
            // the construction throws before any act runs.
            options: { key: { condition: { algorithm: "RS256" } } },
          },
        ],
        when: [{ step: "verify" }],
        then: [{ step: "rejects", error: "AegisKeyError" }],
      };

      await expect(runScenario(scenario, ctx)).rejects.toThrow(AegisKeyError);
    });

    // The CONSUMING half of `readWirePayload`'s unreadability signal: a row that
    // asserts on a payload the interpreter cannot read is FAILED rather than
    // satisfied. That is the promise the rows are written on — `excludes` over a
    // ciphertext payload can never fail, so an encryption row could otherwise
    // claim "the value never reached the wire" without ever looking at one.
    test("should fail a row that asserts on a wire payload it cannot read", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the unreadable-payload guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [
          { step: "token", via: "kit-encrypt", kit: "jwe", data: { hello: "world" } },
        ],
        when: [{ step: "decrypt" }],
        then: [
          { step: "accepts" },
          // Vacuously satisfied by an empty dict, which is precisely why the
          // interpreter must refuse to evaluate it.
          { step: "wirePayload", excludes: ["hello"] },
        ],
      };

      await expect(runScenario(scenario, ctx)).rejects.toThrow(
        /asserts on the cleartext wire payload/,
      );
    });

    // ⚠ LOCAL cast, deliberate: the THEN tuple type makes a verdict in any but
    // the FIRST slot unreachable at compile time, which is exactly why the
    // runtime guard behind it is otherwise never executed. Same treatment as
    // `artifactStepOf`'s unreachable guard above — a guard that has never run is
    // a guess.
    test("should refuse a rejects step that is not the first THEN step", async () => {
      const scenario: Scenario = {
        id: "probe",
        title: "a probe row, for the misplaced-verdict guard alone",
        rationale: "not a capability — this row exists only to exercise the guard.",
        given: [{ step: "claims", claims: { subject: "user-1" } }],
        when: [{ step: "static-assert", assert: { subject: "user-1" } }],
        then: [
          { step: "accepts" },
          { step: "rejects", error: "AegisError" },
        ] as unknown as Scenario["then"],
      };

      await expect(runScenario(scenario, ctx)).rejects.toThrow(
        /may only be the first THEN step/,
      );
    });
  });
});

import { Amphora, type IAmphora } from "@lindorm/amphora";
import { LindormError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { expect } from "vitest";
import { Aegis } from "../classes/Aegis.js";
import {
  AegisDomainError,
  AegisError,
  AegisKeyError,
  CoseError,
  CweError,
  CwmError,
  CwsError,
  CwtError,
  JoseError,
  JweError,
  JwsError,
  JwtError,
} from "../errors/index.js";
import { decodeCwtWire } from "../internal/cose/cwt-token.js";
import type { TokenFormat } from "../internal/utils/select-encoder.js";
import type { TokenFormatTag } from "../types/index.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_ENC,
  TEST_RSA_KEY_SIG,
} from "./keys.js";
import {
  ISSUER,
  type ArtifactGivenStep,
  type ErrorClassName,
  type Given,
  type KeyFixture,
  type PlainVerifyStep,
  type ProfiledVerifyStep,
  type Scenario,
  type ThenStep,
  type WhenStep,
  type Wire,
} from "./scenarios.js";

/**
 * The scenario INTERPRETER — the whole code half of the conformance table, and
 * the future Gherkin step-definition layer.
 *
 * Every step a row may name is implemented here exactly once; a row contributes
 * literals and nothing else. Keeping the two apart is what lets the table be
 * machine-converted later, and it is also what stops a row from quietly encoding
 * behaviour that belongs under test.
 */

/** The clock every row runs at unless a `clock` GIVEN step names another. */
export const DEFAULT_CLOCK = "2024-01-01T08:00:00.000Z";

const KEY_FIXTURES: Record<KeyFixture, IKryptos> = {
  "ec-sig": TEST_EC_KEY_SIG,
  "ec-enc": TEST_EC_KEY_ENC,
  "oct-sig": TEST_OCT_KEY_SIG,
  "oct-enc": TEST_OCT_KEY_ENC,
  "okp-sig": TEST_OKP_KEY_SIG,
  "okp-enc": TEST_OKP_KEY_ENC,
  "rsa-sig": TEST_RSA_KEY_SIG,
  "rsa-enc": TEST_RSA_KEY_ENC,
};

const ERROR_CLASSES: Record<ErrorClassName, typeof LindormError> = {
  AegisError,
  AegisDomainError,
  AegisKeyError,
  JwtError,
  JwsError,
  JweError,
  CwtError,
  CwmError,
  CwsError,
  CweError,
  JoseError,
  CoseError,
  LindormError,
};

export type ScenarioContext = {
  aegis: Aegis;
  amphora: IAmphora;
};

/**
 * The seed suite's setup, verbatim: an Amphora scoped to the test issuer, a mock
 * logger, and the ES512 signing key every row starts from. Further vault
 * residents are added per row by a `keys` GIVEN step.
 */
export const createScenarioContext = async (): Promise<ScenarioContext> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
  const aegis = new Aegis({ amphora, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  return { aegis, amphora };
};

/**
 * The artifact step is the LAST GIVEN step — the tuple type says so, and this
 * says it once at runtime so no reader has to re-derive it from an index.
 */
export const artifactStepOf = (given: Given): ArtifactGivenStep => {
  const last = given[given.length - 1];

  if (last.step === "token" || last.step === "claims") return last;

  throw new Error(`the last GIVEN step must build the artifact, received "${last.step}"`);
};

/**
 * The wire a row targets, derived from how its artifact is built. `mint` and
 * `domain-encrypt` are told by `options.format`; a kit names its own wire. A
 * claim-only row has no wire at all, so it reads as JOSE (the default door).
 *
 * Used by the table's integrity test to assert `absentTwin` names the OTHER
 * wire — a row naming its own would be documenting the absence of itself.
 */
export const wireOf = (scenario: Scenario): Wire => {
  const artifact = artifactStepOf(scenario.given);

  if (artifact.step === "claims") return "jose";

  switch (artifact.via) {
    case "kit-sign":
      return artifact.kit === "cwt" || artifact.kit === "cws" ? "cose" : "jose";

    case "kit-encrypt":
      return artifact.kit === "cwe" ? "cose" : "jose";

    case "mint":
    case "domain-encrypt": {
      const format = artifact.options?.format;
      return isString(format) && format.startsWith("c") ? "cose" : "jose";
    }
  }
};

/**
 * The uniform shape every step reduces to, so an outcome can be asserted without
 * knowing which step produced it. `claims`/`custom`/`header` come from a domain
 * verify, `token`/`format` from any artifact-producing step.
 */
type ScenarioResult = {
  token: string;
  format?: string;
  claims?: Dict;
  custom?: Dict;
  header?: Dict;
};

/**
 * The CLEARTEXT wire payload of an artifact, for the include/exclude assertions.
 *
 * UNREADABILITY IS SIGNALLED, never flattened to an empty dict: a JWE's payload
 * is ciphertext, and `expect({}).not.toHaveProperty(x)` can never fail, so an
 * exclusion asserted against it would pass without checking anything. The caller
 * turns an unreadable payload into a FAILURE. A COSE payload comes back
 * COSE-name-keyed (`cti`, not `jti`).
 */
export type WirePayload =
  | { readable: true; payload: Dict }
  | { readable: false; reason: string };

/**
 * The formats whose payload is ciphertext — the complement of `TokenFormat`, so
 * a new encrypted format is a COMPILE error here rather than a silent omission.
 */
const ENCRYPTED_FORMATS: Record<Exclude<TokenFormatTag, TokenFormat>, true> = {
  jwe: true,
  cwe: true,
};

export const readWirePayload = (token: string, format?: string): WirePayload => {
  // Refuse an ENCRYPTED artifact on its DECLARED format, before touching a byte.
  // Inferring unreadability from the token's SHAPE is JOSE-only reasoning: a JWE
  // is recognisable by its five parts, but a CWE is a COSE_Encrypt0 — a
  // three-element array that satisfies `decodeCwtWire`'s arity check
  // (cwt-token.ts `contents.length < 3`), so its CIPHERTEXT reaches the CBOR
  // decoder and is refused only by the luck of not parsing as CBOR. Luck is not
  // an exclusion, and when it runs out the row passes vacuously.
  if (isString(format) && format in ENCRYPTED_FORMATS) {
    return {
      readable: false,
      reason: `a ${format} artifact's payload is ciphertext, so there is no cleartext wire to read`,
    };
  }

  if (token.includes(".")) {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return {
        readable: false,
        reason: `a ${parts.length}-part JOSE token has no cleartext payload (only a 3-part JWS does; a 5-part JWE's is ciphertext)`,
      };
    }

    // A 3-part token is not necessarily a JWT: `aegis.jws.sign(buffer)` produces a
    // JWS whose payload is opaque bytes. Let that surface as the harness's OWN
    // diagnostic rather than a raw SyntaxError from three frames down — the
    // caller's message names the row's mistake, a SyntaxError names none.
    try {
      return {
        readable: true,
        payload: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Dict,
      };
    } catch (err) {
      return {
        readable: false,
        reason: `the JWS payload is not JSON — it is an opaque body (${(err as Error).message})`,
      };
    }
  }

  try {
    return {
      readable: true,
      payload: decodeCwtWire(Buffer.from(token, "base64url")).payload as Dict,
    };
  } catch (err) {
    return {
      readable: false,
      reason: `the token is not a decodable COSE structure (${(err as Error).message})`,
    };
  }
};

/** GIVEN — stock the vault and set the clock, then build the artifact. */
const applySetup = (given: Given, ctx: ScenarioContext): void => {
  MockDate.set(new Date(DEFAULT_CLOCK));

  for (const step of given) {
    switch (step.step) {
      case "keys":
        for (const fixture of step.keys) {
          ctx.amphora.add(KEY_FIXTURES[fixture]);
        }
        break;

      case "clock":
        MockDate.set(new Date(step.at));
        break;

      case "token":
      case "claims":
        break;
    }
  }
};

const materialise = async (
  artifact: ArtifactGivenStep,
  ctx: ScenarioContext,
): Promise<ScenarioResult> => {
  if (artifact.step === "claims") {
    // No artifact: the static surface operates on the flat dict directly.
    return { token: "", claims: artifact.claims };
  }

  switch (artifact.via) {
    case "mint": {
      // The ONE unavoidable cast, and it costs nothing: `MintGivenStep`
      // correlates `profile` with `content` per member, but at this call site
      // `artifact` is the whole union, and TypeScript cannot carry a per-member
      // correlation into `mint<P>(profile: P, content: ProfileContentFor<P>)` —
      // it infers `P` as the union of every name. The row itself is still checked
      // against its own member, which is where the typo guard lives.
      const signed = await ctx.aegis.mint(
        artifact.profile,
        artifact.content as never,
        artifact.options,
      );
      return { token: signed.token, format: signed.format };
    }

    case "kit-sign": {
      switch (artifact.kit) {
        case "jwt": {
          const signed = await ctx.aegis.jwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "cwt": {
          const signed = await ctx.aegis.cwt.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "jws": {
          const signed = await ctx.aegis.jws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
        case "cws": {
          const signed = await ctx.aegis.cws.sign(artifact.claims, artifact.options);
          return { token: signed.token, format: signed.format };
        }
      }
    }

    case "kit-encrypt": {
      const encrypted =
        artifact.kit === "cwe"
          ? await ctx.aegis.cwe.encrypt(artifact.data, artifact.options)
          : await ctx.aegis.jwe.encrypt(artifact.data, artifact.options);
      return { token: encrypted.token, format: encrypted.format };
    }

    case "domain-encrypt": {
      const encrypted = await ctx.aegis.encrypt(artifact.data, artifact.options);
      return { token: encrypted.token, format: encrypted.format };
    }
  }
};

/**
 * Which verify arity a step asked for. A predicate rather than an inline
 * `when.profile ? …`, so both branches keep their own OPTIONS type: the profiled
 * call is handed `ProfileVerifyOptions` (mandatory `audience`), the plain one
 * `VerifyOptions`.
 */
const isProfiledVerify = (
  step: PlainVerifyStep | ProfiledVerifyStep,
): step is ProfiledVerifyStep => step.profile !== undefined;

const act = async (
  step: WhenStep,
  current: ScenarioResult,
  artifact: ArtifactGivenStep,
  ctx: ScenarioContext,
): Promise<ScenarioResult> => {
  switch (step.step) {
    // The GIVEN's own construction is the act; `materialise` already ran it.
    case "mint":
      return current;

    case "parse": {
      const parsed = ctx.aegis.parse(current.token);
      return {
        token: current.token,
        format: parsed.format,
        claims: parsed.claims as Dict,
        custom: parsed.custom as Dict,
        header: parsed.header as unknown as Dict,
      };
    }

    case "verify": {
      // ⚠ FOUR positionals on the profiled overload — `assert` is the THIRD slot,
      // options the FOURTH. Options in the third slot become claim MATCHERS.
      const verified = isProfiledVerify(step)
        ? await ctx.aegis.verify(step.profile, current.token, step.assert, step.options)
        : await ctx.aegis.verify(current.token, step.assert, step.options);

      return {
        token: verified.token,
        format: verified.format,
        claims: verified.claims as Dict,
        custom: verified.custom as Dict,
        header: verified.header as unknown as Dict,
      };
    }

    case "kit-verify": {
      switch (step.kit) {
        case "jwt": {
          const result = await ctx.aegis.jwt.verify(current.token);
          return {
            token: current.token,
            claims: result.payload as Dict,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "cwt": {
          const result = await ctx.aegis.cwt.verify(current.token);
          return {
            token: current.token,
            claims: result.payload as Dict,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "jws": {
          const result = await ctx.aegis.jws.verify(current.token);
          return {
            token: current.token,
            header: result.protectedHeader as unknown as Dict,
          };
        }
        case "cws": {
          const result = await ctx.aegis.cws.verify(current.token);
          return {
            token: current.token,
            header: result.protectedHeader as unknown as Dict,
          };
        }
      }
    }

    case "decrypt": {
      const decrypted = await ctx.aegis.decrypt(current.token, step.options);
      return {
        token: current.token,
        format: decrypted.format,
        claims: decrypted.claims as Dict,
        custom: decrypted.custom as Dict,
      };
    }

    case "static-assert": {
      if (artifact.step !== "claims") {
        throw new Error(
          `static-assert requires a { step: "claims" } GIVEN, received a "${artifact.via}" token`,
        );
      }
      Aegis.assert(artifact.claims, step.assert, step.options);
      return { token: "", claims: artifact.claims };
    }
  }
};

/**
 * THEN — one observable consequence per step, asserted in the order written.
 *
 * The verdict is the FIRST step (the tuple type enforces it), so this is called
 * with the verdict already settled: an `accepts` row that threw has rethrown, and
 * a `rejects` row never reaches an observation.
 */
const assertObservation = (step: ThenStep, result: ScenarioResult): void => {
  switch (step.step) {
    case "accepts":
      if (step.format !== undefined) {
        expect(result.format).toBe(step.format);
      }
      return;

    case "claims":
      expect(result.claims).toMatchObject(step.expected);
      return;

    case "custom":
      expect(result.custom).toMatchObject(step.expected);
      return;

    case "header":
      expect(result.header).toMatchObject(step.expected);
      return;

    case "wirePayload": {
      const wire = readWirePayload(result.token, result.format);

      // A wire assertion against a payload that cannot be read is VACUOUS, not
      // satisfied — an exclusion over an empty dict can never fail, so a row could
      // claim "the value never reached the wire" without ever looking. Fail it.
      if (wire.readable === false) {
        throw new Error(
          `the row asserts on the cleartext wire payload, but ${wire.reason}. ` +
            "Assert `format` instead, or drop the wire assertion — it cannot be checked here.",
        );
      }

      if (step.includes) {
        expect(wire.payload).toMatchObject(step.includes);
      }
      for (const key of step.excludes ?? []) {
        expect(wire.payload).not.toHaveProperty(key);
      }
      return;
    }

    case "rejects":
      // Unreachable via the tuple type: a rejection is a whole THEN on its own.
      throw new Error("a `rejects` step may only be the first THEN step");
  }
};

const assertOutcome = (
  then: Scenario["then"],
  result: ScenarioResult | undefined,
  error: unknown,
): void => {
  const [verdict] = then;

  if (verdict.step === "rejects") {
    // Name what it resolved TO when it should have thrown: "it resolved" alone
    // does not say whether the check ran and passed or never ran at all.
    const resolved = result
      ? ` — it RESOLVED to ${JSON.stringify({
          format: result.format,
          claims: result.claims,
        })}`
      : "";

    expect(
      error,
      `expected the scenario to REJECT with ${verdict.error}${resolved}`,
    ).toBeInstanceOf(ERROR_CLASSES[verdict.error]);

    if (verdict.data) {
      expect(error).toMatchObject({ data: verdict.data });
    }
    return;
  }

  // Rethrow rather than assert: the real failure message is far more useful than
  // "expected undefined to have property claims".
  if (error !== undefined) throw error;
  if (!result) throw new Error("scenario produced neither a result nor an error");

  for (const step of then) {
    assertObservation(step, result);
  }
};

/**
 * Run one row: apply the setup steps, build the artifact, perform every act in
 * order, assert every consequence.
 *
 * The GIVEN's construction runs OUTSIDE the outcome's try/catch unless the first
 * act is `mint`, where the construction IS the act — otherwise a setup that
 * happened to throw would masquerade as the rejection the row expects.
 *
 * ⚠ A leading `mint` makes the construction the FIRST act, not the only one. The
 * remaining acts run inside the SAME try, so `[{ mint }, { verify }]` reads and
 * behaves as "mint AND THEN verify". Returning after the construction instead —
 * which the type system permits, since `When` is a non-empty tuple and `act` has
 * a `mint` branch — would silently drop every later act and assert the mint alone.
 */
export const runScenario = async (
  scenario: Scenario,
  ctx: ScenarioContext,
): Promise<void> => {
  applySetup(scenario.given, ctx);

  const artifact = artifactStepOf(scenario.given);
  const constructionIsTheAct = scenario.when[0].step === "mint";

  let result: ScenarioResult | undefined;
  let error: unknown;

  if (constructionIsTheAct) {
    try {
      let current = await materialise(artifact, ctx);

      for (const step of scenario.when.slice(1)) {
        current = await act(step, current, artifact, ctx);
      }
      result = current;
    } catch (err) {
      error = err;
    }

    assertOutcome(scenario.then, result, error);
    return;
  }

  let current = await materialise(artifact, ctx);

  try {
    for (const step of scenario.when) {
      current = await act(step, current, artifact, ctx);
    }
    result = current;
  } catch (err) {
    error = err;
  }

  assertOutcome(scenario.then, result, error);
};

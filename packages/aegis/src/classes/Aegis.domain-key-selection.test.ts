import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";

const MOCKED = new Date("2024-01-01T08:00:00.000Z");

MockDate.set(MOCKED);

const ISSUER = "https://test.lindorm.io/";
const CLIENT = "client-1";

/**
 * The DOMAIN verbs' key selection — `aegis.verify` and `aegis.mint`/`aegis.sign`
 * choosing which key answers.
 *
 * ⚠ NOT expressible as conformance rows, and that is the whole reason this file
 * exists. A row is pure JSON and the thing under test here is an `IKryptos`
 * INSTANCE: the caller supplying a key the vault never held, and a deployment
 * stating a vault QUERY that an injected key must not be measured against. The
 * knob matrix reaches the same bags but only through their `condition` member,
 * which is the half a row can spell — so the `kryptos` half of both selectors,
 * and the interaction between the deployment's query and a per-call injection,
 * have no other home.
 *
 * Both halves are one seam apiece and both fail SILENTLY when dropped:
 *
 *   - `Aegis.resolveVerifyKey` reads the supplied key as
 *     `options.verify?.kryptos ?? this.verifyKey.kryptos`. Drop either side and
 *     the resolution falls back to the vault, which is exactly where an inbound
 *     RFC 7523 `client_secret_jwt` assertion's key is NOT.
 *   - `Aegis.resolveSignKey` merges the deployment's condition into the SELECTOR
 *     (a vault query) and never into the floor. Move it and a deployment that
 *     states a signing query cannot sign with an injected key at all, while
 *     every test that only exercises vault keys stays green.
 */
describe("the domain verbs' key selection", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  /**
   * The client secret, spelled as a token the vault never sees. A client
   * authenticates with an assertion it signed itself (RFC 7523 §2.2); a
   * `client_secret_jwt` one is MACed with the shared secret, which is the
   * client's registration record and never a vault resident.
   */
  const clientAssertion = (): string =>
    new JwtKit({ logger, kryptos: TEST_OCT_KEY_SIG }).sign({
      iss: CLIENT,
      sub: CLIENT,
      aud: [ISSUER],
      exp: 1704099600,
      iat: 1704096000,
      jti: "assertion-1",
    });

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("aegis.verify accepts a key the vault never held", () => {
    test("should verify a client assertion with the key the CALL supplies", async () => {
      const token = clientAssertion();

      const verified = await aegis.verify(token, undefined, {
        key: { kryptos: TEST_OCT_KEY_SIG },
      });

      expect(verified.claims.issuer).toBe(CLIENT);

      // …and the injection is what carried it. The secret is not a vault
      // resident, so without the option there is no key to resolve at all —
      // which is what makes the assertion above about the forward and not about
      // the vault answering anyway.
      await expect(aegis.verify(token)).rejects.toThrow();
    });

    test("should verify with the key the DEPLOYMENT supplies when the call names none", async () => {
      const token = clientAssertion();

      const verified = await new Aegis({
        amphora,
        logger,
        verify: { kryptos: TEST_OCT_KEY_SIG },
      }).verify(token);

      expect(verified.claims.issuer).toBe(CLIENT);

      // The same call on the deployment that declares no key has nothing to
      // resolve — the two constructions differ only in the setting.
      await expect(aegis.verify(token)).rejects.toThrow();
    });

    test("should prefer the CALL's key over the deployment's", async () => {
      const token = clientAssertion();

      // The deployment declares a key that cannot check this signature, so a
      // resolution that read the deployment's half first would fail. A per-call
      // key is the narrower statement and wins.
      const verified = await new Aegis({
        amphora,
        logger,
        verify: { kryptos: TEST_OKP_KEY_SIG },
      }).verify(token, undefined, { key: { kryptos: TEST_OCT_KEY_SIG } });

      expect(verified.claims.issuer).toBe(CLIENT);
    });
  });

  describe("a deployment's signing query does not measure an injected key", () => {
    // A deployment's `sign.condition` is a QUERY over its own vault — "which of
    // MY keys" — so it can only ever select. A key supplied outright never came
    // from the vault and cannot satisfy a vault query (a client secret has no
    // `purpose`), so applying the query to it would refuse every injection while
    // a deployment that states no query keeps working. The floor still applies:
    // injection bypasses the vault, never the policy.
    test("should mint with an injected key the deployment's own query would exclude", async () => {
      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { algorithm: "ES512" } },
      });

      const { token } = await deployment.mint(
        "id_token",
        { subject: "user-1", audience: [CLIENT], authTime: MOCKED },
        {
          sign: { key: { kryptos: TEST_OCT_KEY_SIG } },
          // An id_token must state whether an access token co-issued; nothing
          // here turns on it, so the mint says plainly that none did.
          context: { accessTokenIssued: false },
        },
      );

      expect(JwtKit.decode(token).header.alg).toBe("HS256");
    });

    // ⚠ BOTH DIRECTIONS, and the first one is what makes the pair honest. The
    // vault answers a query with `AmphoraState.matchedKeys(...)[0]`, and that
    // list is sorted NEWEST FIRST — so a query naming the NEWER key is satisfied
    // by the vault's own default ordering, and asserting only that direction
    // stays green with the deployment's `sign.condition` deleted outright.
    // Naming the OLDER key is the direction the ordering cannot produce on its
    // own, so it is the one that proves a query ran at all; the newer direction
    // then proves the query is not merely being ignored in favour of the older
    // key. `TEST_EC_KEY_SIG` is the older (ES512), `TEST_OKP_KEY_SIG` the newer
    // (EdDSA).
    test("should sign with the OLDER key when the deployment's query names it", async () => {
      amphora.add(TEST_OKP_KEY_SIG);

      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { algorithm: "ES512" } },
      });

      const { token } = await deployment.mint(
        "id_token",
        { subject: "user-1", audience: [CLIENT], authTime: MOCKED },
        { context: { accessTokenIssued: false } },
      );

      expect(JwtKit.decode(token).header.kid).toBe(TEST_EC_KEY_SIG.id);
    });

    test("should sign with the NEWER key when the deployment's query names it", async () => {
      amphora.add(TEST_OKP_KEY_SIG);

      const deployment = new Aegis({
        amphora,
        logger,
        sign: { condition: { algorithm: "EdDSA" } },
      });

      const { token } = await deployment.mint(
        "id_token",
        { subject: "user-1", audience: [CLIENT], authTime: MOCKED },
        { context: { accessTokenIssued: false } },
      );

      expect(JwtKit.decode(token).header.kid).toBe(TEST_OKP_KEY_SIG.id);
    });
  });
});

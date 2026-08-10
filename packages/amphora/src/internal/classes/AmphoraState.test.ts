import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, type Mocked } from "vitest";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Amphora } from "../../classes/Amphora.js";
import { AmphoraState } from "./AmphoraState.js";

// ⚠ The fixture keys are EXPIRED in real time — without a frozen clock every
// fetched key is rejected as expired, which looks exactly like a failed fetch.
const MockedDate = new Date("2024-01-01T08:00:00.000Z");

const issuer = "https://test.lindorm.io/";

const healthyIssuer = "https://healthy.lindorm.io/";
const healthyJwksUri = "https://healthy.lindorm.io/.well-known/jwks.json";
const deadIssuer = "https://dead.lindorm.io/";
const deadJwksUri = "https://dead.lindorm.io/.well-known/jwks.json";
const clientIssuer = "https://client.lindorm.io/";
const clientJwksUri = "https://client.lindorm.io/.well-known/jwks.json";

// The declared issuer a discovery document overrides — `resolveExternalConfig`
// lets the published `issuer` win, so an entry can be FILED under a name it was
// never registered by.
const publishedIssuer = "https://published.lindorm.io/";

// A JWKS carrying one named key, with `iss` stripped: the fixture keys declare
// the internal test issuer, which every foreign fetch would reject as a mismatch.
const jwksOf = (kryptos: IKryptos) => {
  const jwk = kryptos.toJWK("private");
  delete jwk.iss;
  return { keys: [jwk] };
};

const jwks = () => jwksOf(TEST_EC_KEY_SIG);

// The Amphora child logger — `child()` hands back a NEW mock, so the spies the
// state actually writes to are on the returned instance, not on the root.
const childLogger = (logger: Mocked<ILogger>): Mocked<ILogger> =>
  logger.child.mock.results[0].value as Mocked<ILogger>;

describe("AmphoraState", () => {
  let logger: Mocked<ILogger>;
  let healthyHits: number;
  let deadHits: number;
  let clientHits: number;

  beforeEach(() => {
    MockDate.set(MockedDate);
    logger = createMockLogger();
    healthyHits = 0;
    deadHits = 0;
    clientHits = 0;

    nock(healthyIssuer)
      .persist()
      .get("/.well-known/jwks.json")
      .reply(() => {
        healthyHits += 1;
        return [200, jwks()];
      });

    nock(clientIssuer)
      .persist()
      .get("/.well-known/jwks.json")
      .reply(() => {
        clientHits += 1;
        return [200, jwks()];
      });
  });

  afterEach(() => {
    nock.cleanAll();
    MockDate.set(MockedDate);
  });

  const mockDeadIssuer = (status: number): void => {
    nock(deadIssuer)
      .persist()
      .get("/.well-known/jwks.json")
      .reply(() => {
        deadHits += 1;
        return [status, { error: "boom" }];
      });
  };

  describe("retry backoff on a failing issuer", () => {
    test("should stop re-attempting a NEVER-succeeded issuer on every unscoped lookup", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [
          { issuer: healthyIssuer, jwksUri: healthyJwksUri },
          { issuer: deadIssuer, jwksUri: deadJwksUri },
        ],
      });

      await amphora.setup();

      const afterSetup = deadHits;
      expect(afterSetup).toBeGreaterThan(0);

      for (let i = 0; i < 5; i++) {
        await amphora.filter({ use: "sig" });
      }

      // The dead entry has no `lastRefresh` to measure an interval from, so
      // before the backoff stamp it counted as stale forever and dragged every
      // unscoped lookup — including the healthy issuer — into a full sweep.
      expect(deadHits).toBe(afterSetup);
      expect(healthyHits).toBe(1);
    });

    test("should re-attempt once the backoff window has passed", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [
          { issuer: healthyIssuer, jwksUri: healthyJwksUri },
          { issuer: deadIssuer, jwksUri: deadJwksUri },
        ],
      });

      await amphora.setup();
      const afterSetup = deadHits;

      MockDate.set(new Date(MockedDate.getTime() + 300_001));

      await amphora.filter({ use: "sig" });

      expect(deadHits).toBeGreaterThan(afterSetup);
    });

    test("should hold the backoff for the FULL refreshInterval, not computeDelay's default cap", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [
          { issuer: healthyIssuer, jwksUri: healthyJwksUri },
          { issuer: deadIssuer, jwksUri: deadJwksUri },
        ],
      });

      await amphora.setup();

      const afterSetup = deadHits;
      expect(afterSetup).toBeGreaterThan(0);

      // Past `computeDelay`'s DEFAULT 30s `delayMax` and nowhere near the 300s
      // floor this backoff is: the window must still hold. It only does because
      // EXTERNAL_RETRY_DELAY states `delayMax: Infinity` — the default cap would
      // silently truncate every refreshInterval above 30s, turning a 5-minute
      // floor into a 30-second one and re-attempting a dead issuer ten times as
      // often as declared.
      MockDate.set(new Date(MockedDate.getTime() + 30_001));

      await amphora.filter({ use: "sig" });

      expect(deadHits).toBe(afterSetup);
      expect(healthyHits).toBe(1);

      MockDate.set(new Date(MockedDate.getTime() + 300_001));

      await amphora.filter({ use: "sig" });

      expect(deadHits).toBeGreaterThan(afterSetup);
    });

    test("should NEVER gate a miss on the backoff window", async () => {
      // 404 first (so the backoff is stamped), then serve keys: a client that
      // fixes its endpoint and rotates a kid must be reachable immediately.
      nock(deadIssuer)
        .get("/.well-known/jwks.json")
        .times(3)
        .reply(() => {
          deadHits += 1;
          return [503, { error: "boom" }];
        });

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [{ issuer: deadIssuer, jwksUri: deadJwksUri }],
      });

      await amphora.setup();
      expect(deadHits).toBe(3);

      nock(deadIssuer)
        .get("/.well-known/jwks.json")
        .reply(() => {
          deadHits += 1;
          return [200, jwks()];
        });

      // Same instant — well inside the backoff window.
      const found = await amphora.findById(TEST_EC_KEY_SIG.id, deadIssuer);

      expect(found.id).toBe(TEST_EC_KEY_SIG.id);
      expect(deadHits).toBe(4);
    });

    test("should clear the retry state on a successful load", async () => {
      nock(deadIssuer)
        .get("/.well-known/jwks.json")
        .times(3)
        .reply(() => {
          deadHits += 1;
          return [503, { error: "boom" }];
        });

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [{ issuer: deadIssuer, jwksUri: deadJwksUri }],
      });

      await amphora.setup();

      nock(deadIssuer)
        .persist()
        .get("/.well-known/jwks.json")
        .reply(() => {
          deadHits += 1;
          return [200, jwks()];
        });

      await amphora.external.refresh(deadIssuer);
      const afterRecovery = deadHits;

      // Recovered and fresh — the cleared `retryAfter` must not still gate, and
      // the cleared `lastRefresh` must now hold off the speculative refetch.
      await amphora.filter({ use: "sig" });

      expect(deadHits).toBe(afterRecovery);
      expect(childLogger(logger).info).toHaveBeenCalledWith(
        "External issuer recovered",
        expect.objectContaining({ issuer: deadIssuer, origin: "declared" }),
      );
    });
  });

  describe("the scheduled sweep covers DECLARED entries only", () => {
    test("should not refetch a registered issuer on refresh()", async () => {
      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [{ issuer: healthyIssuer, jwksUri: healthyJwksUri }],
      });

      await amphora.setup();
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      expect(clientHits).toBe(1);

      await amphora.refresh();

      expect(healthyHits).toBe(2);
      expect(clientHits).toBe(1);
    });

    test("should keep a SCOPED lookup refreshing a stale registered issuer", async () => {
      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [{ issuer: healthyIssuer, jwksUri: healthyJwksUri }],
      });

      await amphora.setup();
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      MockDate.set(new Date(MockedDate.getTime() + 300_001));

      await amphora.filter({ issuer: clientIssuer });

      expect(clientHits).toBe(2);
    });

    test("should report the sweep summary once, counting the skipped registrations", async () => {
      const amphora = new Amphora({
        internal: { issuer },
        logger,
        external: [{ issuer: healthyIssuer, jwksUri: healthyJwksUri }],
      });

      await amphora.setup();
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      childLogger(logger).verbose.mockClear();

      await amphora.refresh();

      expect(childLogger(logger).verbose).toHaveBeenCalledTimes(1);
      expect(childLogger(logger).verbose).toHaveBeenCalledWith(
        "External refresh sweep complete",
        expect.objectContaining({
          attempted: 1,
          succeeded: 1,
          failed: 0,
          skipped: 1,
        }),
      );
    });
  });

  describe("addIssuer is idempotent by issuer", () => {
    test("should REPLACE rather than append on a second registration", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger });

      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      expect(amphora.external.issuers()).toHaveLength(1);
      expect(clientHits).toBe(2);
    });

    test("should collapse concurrent registrations of one issuer into one fetch", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger });

      await Promise.all([
        amphora.external.addIssuer({ issuer: clientIssuer, jwksUri: clientJwksUri }),
        amphora.external.addIssuer({ issuer: clientIssuer, jwksUri: clientJwksUri }),
        amphora.external.addIssuer({ issuer: clientIssuer, jwksUri: clientJwksUri }),
      ]);

      expect(amphora.external.issuers()).toHaveLength(1);
      expect(clientHits).toBe(1);
    });

    test("should leave no ghost behind when the issuer is removed", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger });

      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      amphora.external.removeIssuer(clientIssuer);

      expect(amphora.external.issuers()).toEqual([]);
      expect(amphora.vault.filter((i) => i.issuer === clientIssuer)).toEqual([]);
    });

    test("should spend only ONE issuer slot for repeated registrations", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger, maxIssuers: 2 });

      await amphora.external.addIssuer({
        issuer: healthyIssuer,
        jwksUri: healthyJwksUri,
      });
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      // The duplicate must not push the set past the cap and evict the peer.
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      expect(
        amphora.external
          .issuers()
          .map((config) => config.issuer)
          .sort(),
      ).toEqual([clientIssuer, healthyIssuer]);
    });
  });

  describe("failure logging by provenance", () => {
    test("should warn ONCE for a declared issuer and drop to debug on repeats", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        external: [{ issuer: deadIssuer, jwksUri: deadJwksUri }],
      });

      await amphora.setup();

      const child = childLogger(logger);

      expect(child.warn).toHaveBeenCalledTimes(1);
      expect(child.warn).toHaveBeenCalledWith(
        "Failed to refresh external JWKS",
        expect.objectContaining({ origin: "declared", failureCount: 1 }),
      );

      child.debug.mockClear();
      MockDate.set(new Date(MockedDate.getTime() + 300_001));

      await amphora.refresh();

      expect(child.warn).toHaveBeenCalledTimes(1);
      expect(child.debug).toHaveBeenCalledWith(
        "Failed to refresh external JWKS",
        expect.objectContaining({ origin: "declared", failureCount: 2 }),
      );
    });

    test("should never warn for a registered issuer", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({ internal: { issuer }, logger });

      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      // Point the registered entry at the dead endpoint and refresh it.
      await expect(
        amphora.external.addIssuer({ issuer: deadIssuer, jwksUri: deadJwksUri }),
      ).rejects.toThrow();

      await expect(amphora.external.refresh(clientIssuer)).resolves.toBeUndefined();

      expect(childLogger(logger).warn).not.toHaveBeenCalled();
    });

    test("should back off a registered issuer that fails a scoped refresh", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
      });

      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      nock.cleanAll();
      nock(clientIssuer)
        .persist()
        .get("/.well-known/jwks.json")
        .reply(() => {
          clientHits += 1;
          return [503, { error: "boom" }];
        });

      MockDate.set(new Date(MockedDate.getTime() + 300_001));

      // The refetch fails, but the keys already held still answer the query, so
      // the lookup is served from cache rather than denied — the failure is
      // recorded and backed off all the same, which is what this asserts.
      await expect(amphora.filter({ issuer: clientIssuer })).resolves.toEqual([
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      ]);

      const afterFailure = clientHits;

      // Still stale by the clock, but inside the backoff window — and the query
      // is satisfied by the keys already held, so this must not refetch.
      await amphora.filter({ issuer: clientIssuer });

      expect(clientHits).toBe(afterFailure);

      expect(childLogger(logger).debug).toHaveBeenCalledWith(
        "Failed to refresh external issuer",
        expect.objectContaining({ origin: "registered", failureCount: 1 }),
      );
    });
  });

  describe("replacing an entry filed under a different issuer", () => {
    test("should evict the replaced entry's keys instead of stranding them", async () => {
      // A discovery document whose published issuer differs from the declared
      // one: the entry is MATCHED by `input.issuer` but FILES its keys under the
      // published name.
      nock(clientIssuer)
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, { issuer: publishedIssuer, jwks_uri: clientJwksUri });

      const amphora = new Amphora({ internal: { issuer }, logger });

      await amphora.external.addIssuer({ issuer: clientIssuer });

      expect(amphora.external.issuers().map((config) => config.issuer)).toEqual([
        publishedIssuer,
      ]);
      expect(amphora.vault.map((key) => key.issuer)).toEqual([publishedIssuer]);

      // Re-registering the SAME declared issuer, now with an explicit jwksUri, so
      // it resolves to the declared name and replaces the entry above.
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      expect(amphora.external.issuers().map((config) => config.issuer)).toEqual([
        clientIssuer,
      ]);

      // The replaced entry's keys must go with it. Left behind they are
      // unreachable: no entry names `publishedIssuer` any more, so `removeIssuer`
      // cannot evict them and a bare-id lookup sees two keys with one kid.
      expect(amphora.vault.map((key) => key.issuer)).toEqual([clientIssuer]);
    });

    test("should keep the replacement's keys when both entries file under one issuer", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger });

      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });
      await amphora.external.addIssuer({
        issuer: clientIssuer,
        jwksUri: clientJwksUri,
      });

      expect(amphora.vault.map((key) => key.issuer)).toEqual([clientIssuer]);
    });
  });

  describe("idp refresh records its failures", () => {
    test("should warn once, back off, and drop to debug on a repeat failure", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        idp: { issuer: deadIssuer, jwksUri: deadJwksUri },
      });

      const child = childLogger(logger);

      await expect(amphora.idp.refresh()).rejects.toThrow();

      // The idp is DECLARED however it arrived, so the first failure is the warn
      // that says an operator's upstream went down — and it is stamped with the
      // same backoff an external issuer's failure gets.
      expect(child.warn).toHaveBeenCalledTimes(1);
      expect(child.warn).toHaveBeenCalledWith(
        "Failed to refresh external issuer",
        expect.objectContaining({
          issuer: deadIssuer,
          origin: "declared",
          failureCount: 1,
          retryAfter: new Date(MockedDate.getTime() + 300_000),
        }),
      );

      child.debug.mockClear();

      await expect(amphora.idp.refresh()).rejects.toThrow();

      expect(child.warn).toHaveBeenCalledTimes(1);
      expect(child.debug).toHaveBeenCalledWith(
        "Failed to refresh external issuer",
        expect.objectContaining({ origin: "declared", failureCount: 2 }),
      );
    });

    test("should report the idp recovering at info", async () => {
      mockDeadIssuer(503);

      const amphora = new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 300_000,
        idp: { issuer: deadIssuer, jwksUri: deadJwksUri },
      });

      await expect(amphora.idp.refresh()).rejects.toThrow();

      nock.cleanAll();
      nock(deadIssuer)
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(() => {
          deadHits += 1;
          return [200, jwks()];
        });

      await expect(amphora.idp.refresh()).resolves.toBeUndefined();

      expect(childLogger(logger).info).toHaveBeenCalledWith(
        "External issuer recovered",
        expect.objectContaining({ issuer: deadIssuer, origin: "declared" }),
      );
    });
  });

  describe("a load that lands after its entry was replaced", () => {
    const raceIssuer = "https://race.lindorm.io/";
    const raceJwksUri = "https://race.lindorm.io/.well-known/jwks.json";
    const raceAltJwksUri = "https://race.lindorm.io/alt/jwks.json";

    test("should not reinstate the superseded source's keys", async () => {
      const amphora = new Amphora({ internal: { issuer }, logger });

      nock(raceIssuer)
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, jwksOf(TEST_EC_KEY_SIG));

      await amphora.external.addIssuer({ issuer: raceIssuer, jwksUri: raceJwksUri });

      // A refresh of the CURRENT source, held open at the endpoint...
      nock(raceIssuer)
        .get("/.well-known/jwks.json")
        .times(1)
        .delay(250)
        .reply(200, jwksOf(TEST_EC_KEY_SIG));

      const late = amphora.external.refresh(raceIssuer);

      // ...while a re-registration for the same issuer, naming a DIFFERENT
      // source, resolves and installs first. Registration and refresh dedupe in
      // separate maps, so neither joins the other.
      nock(raceIssuer).get("/alt/jwks.json").times(1).reply(200, jwksOf(TEST_EC_KEY_ENC));

      await amphora.external.addIssuer({ issuer: raceIssuer, jwksUri: raceAltJwksUri });

      await expect(late).resolves.toBeUndefined();

      // The listing names the new source, so the vault must hold ITS keys — the
      // late load belongs to an entry amphora no longer holds.
      expect(amphora.external.issuers().map((config) => config.jwksUri)).toEqual([
        raceAltJwksUri,
      ]);
      expect(amphora.vault.map((key) => key.id)).toEqual([TEST_EC_KEY_ENC.id]);
    });
  });

  // The publish gate, exercised on RAW conditions — the state is reached here
  // directly, so nothing has normalised them. `Amphora`'s public boundary
  // strips unspecified keys before they arrive, but the gate must be right
  // without that: it INSPECTS the condition to pick a policy, and "specified"
  // is `!== undefined`, never key presence.
  describe("filteredKeys publish gate", () => {
    const published = TEST_EC_KEY_SIG;
    const internalSig = KryptosKit.clone(TEST_EC_KEY_SIG, {
      id: "8a3b3a3f-0c6e-5f9d-9a1e-2c7d4e5f6a7b",
      publish: false,
      purpose: "cookie",
    });

    const state = (): AmphoraState => {
      const instance = new AmphoraState({ internal: { issuer }, logger });
      instance.addInternalKeys([published, internalSig]);
      return instance;
    };

    test("should hide an internal unpublished key from a condition naming no publish", () => {
      expect(
        state()
          .filteredKeys({ use: "sig" })
          .map((key) => key.id),
      ).toEqual([published.id]);
    });

    test("should hide an internal unpublished key from a condition whose publish is undefined", () => {
      expect(
        state()
          .filteredKeys({ use: "sig", publish: undefined })
          .map((key) => key.id),
      ).toEqual([published.id]);
    });

    test("should honour an explicit publish value", () => {
      expect(
        state()
          .filteredKeys({ use: "sig", publish: false })
          .map((key) => key.id),
      ).toEqual([internalSig.id]);
      expect(
        state()
          .filteredKeys({ use: "sig", publish: true })
          .map((key) => key.id),
      ).toEqual([published.id]);
    });

    // An OPERATOR is an explicit statement about `publish`, so it opts out of
    // the default gate exactly as a literal does — the gate asks whether the
    // caller said anything, not what they said.
    test("should treat an operator on publish as naming it", () => {
      expect(
        state()
          .filteredKeys({ use: "sig", publish: { $exists: true } })
          .map((key) => key.id)
          .sort(),
      ).toEqual([published.id, internalSig.id].sort());
    });
  });
});

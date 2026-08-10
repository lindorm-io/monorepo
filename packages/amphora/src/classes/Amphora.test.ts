import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockKryptos } from "@lindorm/kryptos/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import nock from "nock";
import {
  OPEN_ID_CONFIGURATION_RESPONSE,
  OPEN_ID_JWKS_RESPONSE,
} from "../__fixtures__/auth0.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_ENC,
  TEST_RSA_KEY_SIG,
} from "../__fixtures__/keys.js";
import { TEST_X509_KRYPTOS_SIG } from "../__fixtures__/x509.js";
import { AmphoraError } from "../errors/index.js";
import { Amphora } from "./Amphora.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Amphora", () => {
  const issuer = "https://test.lindorm.io/";

  let amphora: Amphora;

  beforeEach(() => {
    amphora = new Amphora({ internal: { issuer }, logger: createMockLogger() });
  });

  describe("add", () => {
    test("should add key to vault", () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.vault).toEqual([TEST_EC_KEY_SIG]);
    });

    test("should add multiple keys to vault", () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      expect(amphora.vault).toEqual([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);
    });

    test("should only keep one copy of each key id", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG, TEST_EC_KEY_SIG]);

      expect(amphora.vault).toEqual([TEST_EC_KEY_SIG]);
    });

    test("should update jwks when adding key", () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      expect(amphora.jwks).toMatchSnapshot();
    });
  });

  describe("env", () => {
    test("should add keys to vault from env", () => {
      amphora.env([
        "kryptos:eyJlbmMiOiJBMTkyR0NNIiwiaWF0IjoxNzQ0NzA0MjYzLCJrZXlfb3BzIjpbImRlcml2ZUtleSJdLCJuYmYiOjE3NDQ3MDQyNjMsInB1cnBvc2UiOiJ0ZXN0IiwidWF0IjoxNzQ0NzA0MjYzLCJjcnYiOiJQLTM4NCIsIngiOiJGMTgyVlNMMURyRll5b19feVJ3eXlvS3JtT08wVEU0MktxT0pOQk1CNlgxSlFYbGV1MTVqYVpsN3dHdG5XcmxUIiwieSI6IlM3bElSZG45dlh5QnF4S0FSUTZzampLcXlCekt1T3VJM1BYcExlUEZ3bmpXNDduWEVVN2hDMzNydmF5ZzVZbVkiLCJkIjoiVzlRNmZMc2J2NkN0dk1zWUUyOTJha2VqeUlZeHFUY1BGSTQzUE9Fd1dpeVRrMFhhelk4NEREQnpHZlNVNEhmOCIsImtpZCI6IjE2NmM2YWI2LWRmOWYtNGZkYS1hYWI4LTkyMTM5ZWY2NDc5MiIsImFsZyI6IkVDREgtRVMrQTE5MktXIiwidXNlIjoiZW5jIiwia3R5IjoiRUMifQ",
        "kryptos:eyJpYXQiOjE3NDQ3MDQyMjgsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3NDQ3MDQyMjgsInB1cnBvc2UiOiJ0ZXN0IiwidWF0IjoxNzQ0NzA0MjI4LCJjcnYiOiJFZDI1NTE5IiwieCI6IlBqeDJjSWRtS0lkdGh5V2ZEakxjTnlKOWt6RW9ObnlWWjZCckZVZWUxc2ciLCJkIjoiMzhFS1ZrRjZBaGM0RWFUNm9XcWlGajdzejZ3czdjLXk2ZjgycHAzNHNFZyIsImtpZCI6IjM4MTQ0NTdmLTI2OGItNGQyMi1hNjQ0LTZhZTY5YjdjNzRiMSIsImFsZyI6IkVkRFNBIiwidXNlIjoic2lnIiwia3R5IjoiT0tQIn0",
      ]);

      expect(amphora.vault).toEqual([
        expect.objectContaining({
          id: "166c6ab6-df9f-4fda-aab8-92139ef64792",
          type: "EC",
        }),
        expect.objectContaining({
          id: "3814457f-268b-4d22-a644-6ae69b7c74b1",
          type: "OKP",
        }),
      ]);
    });

    test("should mark env-imported keys as own and serve them in the jwks", () => {
      amphora.env(KryptosKit.env.export(TEST_EC_KEY_SIG));

      expect(amphora.vault[0].internal).toBe(true);
      expect(amphora.jwks.keys.some((k) => k.kid === TEST_EC_KEY_SIG.id)).toBe(true);
    });

    test("should warn when an env-imported key issuer differs from the amphora issuer", () => {
      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);
      const scoped = new Amphora({ internal: { issuer }, logger });

      const foreign = KryptosKit.from.jwk(
        { ...TEST_EC_KEY_SIG.toJWK("private"), iss: "https://other.lindorm.io/" },
        false,
      );
      scoped.env(KryptosKit.env.export(foreign));

      expect(child.warn).toHaveBeenCalledWith(
        "Env-imported key issuer differs from amphora issuer",
        expect.objectContaining({
          expected: issuer,
          actual: "https://other.lindorm.io/",
        }),
      );
    });
  });

  describe("filter", () => {
    test("should filter kryptos by active", async () => {
      const key = KryptosKit.clone(TEST_EC_KEY_SIG, {
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
      });

      amphora.add([key, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should filter kryptos by issuer", async () => {
      const kryptos = KryptosKit.generate.sig.oct({
        algorithm: "HS256",
        issuer: "https://other.lindorm.io/",
        // Published, so it is the ISSUER query that excludes it — not the
        // publish default.
        publish: true,
      });

      amphora.add([kryptos, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer })).resolves.toEqual([TEST_OCT_KEY_SIG]);
    });

    test("should filter kryptos and sort them by creation date", async () => {
      amphora.add([
        TEST_EC_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_RSA_KEY_SIG,
      ]);

      await expect(amphora.filter({ issuer, hasPrivateKey: true })).resolves.toEqual([
        TEST_RSA_KEY_SIG,
        TEST_OKP_KEY_SIG,
        TEST_OCT_KEY_SIG,
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the private query", async () => {
      const { privateKey, ...der } = TEST_OKP_KEY_SIG.export("der");
      // Published, so it is the hasPrivateKey query that excludes it — not the
      // publish default.
      const key = KryptosKit.from.der({ issuer, ...der, publish: true });

      amphora.add([TEST_EC_KEY_SIG, key]);

      await expect(amphora.filter({ issuer, hasPrivateKey: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the public query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, hasPublicKey: true })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the derived operation query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG, TEST_EC_KEY_ENC]);

      await expect(
        amphora.filter({ issuer, operations: ["deriveKey"] }),
      ).resolves.toEqual([TEST_EC_KEY_ENC]);
    });

    // The derived class, not a hand-written `type: { $nin: ["oct"] }` — the point
    // of the field is that this query cannot rot when a sixth key type lands.
    test("should filter kryptos in vault using the derived algClass query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, algClass: "asymmetric" })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
      await expect(amphora.filter({ issuer, algClass: "symmetric" })).resolves.toEqual([
        TEST_OCT_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the type query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(amphora.filter({ issuer, type: "oct" })).resolves.toEqual([
        TEST_OCT_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault using the use query", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC]);

      await expect(amphora.filter({ issuer, use: "sig" })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });

    test("should filter kryptos in vault synchronously", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.filterSync({ issuer, id: TEST_EC_KEY_SIG.id })).toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });
  });

  describe("find", () => {
    test("should find kryptos in vault using id", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        TEST_EC_KEY_SIG,
      );
    });

    test("should find kryptos in vault synchronously", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(amphora.findSync({ issuer, id: TEST_EC_KEY_SIG.id })).toEqual(
        TEST_EC_KEY_SIG,
      );
    });
  });

  describe("findById", () => {
    afterEach(() => {
      MockDate.set(MockedDate);
    });

    test("should find a not-yet-active key (notBefore in future) by id", () => {
      const future = KryptosKit.clone(TEST_EC_KEY_SIG, {
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
      });
      amphora.add(future);

      expect(amphora.findByIdSync(future.id)).toEqual(future);
    });

    test("should find an expired key by id after time advances past expiresAt", () => {
      const key = KryptosKit.clone(TEST_EC_KEY_SIG, {
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      });
      amphora.add(key);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      expect(key.isExpired).toBe(true);
      expect(amphora.findByIdSync(key.id)).toEqual(key);
    });

    test("should find a not-yet-active key via async findById", async () => {
      const future = KryptosKit.clone(TEST_EC_KEY_SIG, {
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
      });
      amphora.add(future);

      await expect(amphora.findById(future.id)).resolves.toEqual(future);
    });

    test("should throw AmphoraError when findByIdSync misses", () => {
      amphora.add(TEST_EC_KEY_SIG);

      expect(() => amphora.findByIdSync("does-not-exist")).toThrow(AmphoraError);
      expect(() => amphora.findByIdSync("does-not-exist")).toThrow(
        "Kryptos not found by id",
      );
    });

    test("should throw AmphoraError when async findById misses without external providers", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.findById("does-not-exist")).rejects.toThrow(
        "Kryptos not found by id",
      );
    });

    test("should refresh and retry when findById misses and external providers exist", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.findById(TEST_EC_KEY_SIG.id)).resolves.toEqual(
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      );
      expect(nock.isDone()).toBe(true);
    });

    test("does not follow a redirect on an external JWKS fetch (SSRF hardening)", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      // The external jwks_uri passed a caller's egress guard, then 302-redirects
      // to an internal metadata host. With maxRedirects defaulting to 0 the
      // redirect is NOT followed, so the internal host is never contacted.
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .reply(302, undefined, {
          Location: "http://169.254.169.254/.well-known/jwks.json",
        });

      const internal = nock("http://169.254.169.254")
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      // The redirected-to key never loads (the fetch fails on the 302), and the
      // internal interceptor is never consumed.
      await expect(amphora.findById(TEST_EC_KEY_SIG.id)).rejects.toThrow();
      expect(internal.isDone()).toBe(false);

      nock.cleanAll();
    });

    test("routes external fetches through the supplied lookup (SSRF IP-pin)", async () => {
      // A throwing lookup proves the fetch is pinned to the resolver: the http
      // adapter invokes it before any socket, so no network is touched. The
      // resolver is called with the jwks_uri host — a real egress lookup would
      // validate that host's address and return the vetted IP.
      const lookup = vi.fn(async (_hostname: string) => {
        throw new Error("egress blocked");
      });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        lookup,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.findById(TEST_EC_KEY_SIG.id)).rejects.toThrow();
      expect(lookup).toHaveBeenCalled();
      expect(lookup.mock.calls[0]![0]).toBe("external.lindorm.io");
    });

    test("follows a redirect when maxRedirects is explicitly raised", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .reply(302, undefined, {
          Location: "https://external.lindorm.io/redirected/jwks.json",
        });
      nock("https://external.lindorm.io")
        .get("/redirected/jwks.json")
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxRedirects: 1,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.findById(TEST_EC_KEY_SIG.id)).resolves.toEqual(
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      );
      expect(nock.isDone()).toBe(true);
    });

    test("should throw from findByIdSync when setup not called with external providers", () => {
      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(() => amphora.findByIdSync("anything")).toThrow(
        "setup() must be called before using sync methods with external providers",
      );
    });
  });

  describe("vault retention", () => {
    afterEach(() => {
      MockDate.set(MockedDate);
    });

    test("should retain expired non-external keys across refresh", async () => {
      const key = KryptosKit.clone(TEST_EC_KEY_SIG, {
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      });
      amphora.add(key);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      await amphora.refresh();

      expect(amphora.vault.find((k) => k.id === key.id)).toBeDefined();
      expect(amphora.findByIdSync(key.id)).toEqual(key);
    });
  });

  describe("JWKS publication window", () => {
    test("should include not-yet-active (notBefore in future) keys in JWKS", () => {
      const future = KryptosKit.clone(TEST_EC_KEY_SIG, {
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
      });
      amphora.add(future);

      expect(amphora.jwks).toMatchSnapshot();
    });

    test("should exclude expired keys from JWKS", () => {
      const key = KryptosKit.clone(TEST_EC_KEY_SIG, {
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      });
      amphora.add(key);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));
      // refresh JWKS by adding another unrelated key
      amphora.add(TEST_OCT_KEY_SIG);
      MockDate.set(MockedDate);

      expect(amphora.jwks.keys.some((k) => k.kid === key.id)).toBe(false);
    });
  });

  describe("publish", () => {
    // An internal key (KEK, CA, cookie, session) is hidden from SELECTION, not
    // merely from publication. The HS256 cookie key below is deliberately NEWER
    // than the published EdDSA key: filteredKeys sorts newest-first, so before
    // the publish default it was the key `find({ use: "sig" })` handed back —
    // signing access tokens with a symmetric key absent from the JWKS.
    const internalSig = KryptosKit.clone(TEST_OCT_KEY_SIG, {
      createdAt: new Date("2024-01-01T00:09:00.000Z"),
      publish: false,
      purpose: "cookie",
    });

    test("should not select an internal key over a published one, even when it is newer", async () => {
      amphora.add([internalSig, TEST_OKP_KEY_SIG]);

      expect(internalSig.createdAt.getTime()).toBeGreaterThan(
        TEST_OKP_KEY_SIG.createdAt.getTime(),
      );

      await expect(amphora.find({ use: "sig" })).resolves.toEqual(TEST_OKP_KEY_SIG);
      expect(amphora.findSync({ use: "sig" })).toEqual(TEST_OKP_KEY_SIG);
      await expect(amphora.filter({ use: "sig" })).resolves.toEqual([TEST_OKP_KEY_SIG]);
    });

    test("should throw rather than hand back an internal key when it is the only match", async () => {
      amphora.add(internalSig);

      await expect(amphora.find({ use: "sig" })).rejects.toThrow(AmphoraError);
      expect(() => amphora.findSync({ use: "sig" })).toThrow(AmphoraError);
      await expect(amphora.filter({ use: "sig" })).resolves.toEqual([]);
    });

    test("should select an internal key when the caller asks for one", async () => {
      amphora.add([internalSig, TEST_OKP_KEY_SIG]);

      await expect(amphora.find({ use: "sig", publish: false })).resolves.toEqual(
        internalSig,
      );
      expect(amphora.filterSync({ use: "sig", publish: false })).toEqual([internalSig]);
    });

    test("should return both published and internal keys when the caller asks for both", async () => {
      amphora.add([internalSig, TEST_OKP_KEY_SIG]);

      await expect(
        amphora.filter({ use: "sig", publish: { $exists: true } }),
      ).resolves.toEqual([internalSig, TEST_OKP_KEY_SIG]);
    });

    test("should find an internal key by id", async () => {
      amphora.add(internalSig);

      await expect(amphora.findById(internalSig.id)).resolves.toEqual(internalSig);
      expect(amphora.findByIdSync(internalSig.id)).toEqual(internalSig);
    });

    // The publish gate governs SELECTION only. A capability answers "does the
    // vault hold a key that can do this?", and an internal unpublished key
    // signs and verifies perfectly well — it is merely never handed out by a
    // vacuous query. Reporting `false` here made the probe contradict the
    // operation it describes: pylon skipped decrypting an encrypted session on
    // exactly this vault shape and served the ciphertext as a bearer token.
    test("should still report signing capability for a vault holding only internal keys", () => {
      amphora.add(internalSig);

      expect(amphora.filterSync({ use: "sig" })).toEqual([]);

      expect(amphora.canSign()).toBe(true);
      expect(amphora.canVerify()).toBe(true);
    });

    test("should exclude internal keys from the jwks", () => {
      const internalEc = KryptosKit.clone(TEST_EC_KEY_SIG, { publish: false });

      amphora.add([internalEc, TEST_OKP_KEY_SIG]);

      expect(internalEc.hasPublicKey).toBe(true);
      expect(amphora.jwks.keys.some((k) => k.kid === internalEc.id)).toBe(false);
      expect(amphora.jwks.keys.some((k) => k.kid === TEST_OKP_KEY_SIG.id)).toBe(true);
    });

    // `undefined` ≡ ABSENT, everywhere: a condition value of `undefined` means
    // "not specified". A consumer writing `filter({ publish: cfg.publish })`
    // against an unset config field is therefore asking nothing about
    // `publish`, and must get the DEFAULT gate — not an opt-out of it.
    //
    // The gate used to read key PRESENCE (`"publish" in condition`), which is
    // true for a key present with the value `undefined`. So such a caller
    // skipped the gate while the matcher, treating the same value as "no
    // constraint", constrained nothing either — and every internal unpublished
    // key (the KEK, the CA, the cookie key) was handed back to a caller who
    // asked for published ones. `find` takes `[0]` of a newest-first sort, so
    // the caller silently received whichever internal key was newest.
    describe("undefined is not an opt-out of the publish gate", () => {
      test("should apply the default gate when publish is undefined", async () => {
        amphora.add([internalSig, TEST_OKP_KEY_SIG]);

        await expect(amphora.filter({ use: "sig", publish: undefined })).resolves.toEqual(
          [TEST_OKP_KEY_SIG],
        );
        expect(amphora.filterSync({ use: "sig", publish: undefined })).toEqual([
          TEST_OKP_KEY_SIG,
        ]);
        await expect(amphora.find({ use: "sig", publish: undefined })).resolves.toEqual(
          TEST_OKP_KEY_SIG,
        );
        expect(amphora.findSync({ use: "sig", publish: undefined })).toEqual(
          TEST_OKP_KEY_SIG,
        );
      });

      test("should throw rather than hand back an internal key when publish is undefined", async () => {
        amphora.add(internalSig);

        await expect(amphora.filter({ use: "sig", publish: undefined })).resolves.toEqual(
          [],
        );
        expect(amphora.filterSync({ use: "sig", publish: undefined })).toEqual([]);
        await expect(amphora.find({ use: "sig", publish: undefined })).rejects.toThrow(
          AmphoraError,
        );
        expect(() => amphora.findSync({ use: "sig", publish: undefined })).toThrow(
          AmphoraError,
        );
      });

      test("should keep an explicit publish value meaning exactly what it meant", async () => {
        amphora.add([internalSig, TEST_OKP_KEY_SIG]);

        await expect(amphora.filter({ use: "sig", publish: false })).resolves.toEqual([
          internalSig,
        ]);
        expect(amphora.filterSync({ use: "sig", publish: false })).toEqual([internalSig]);
        await expect(amphora.find({ use: "sig", publish: false })).resolves.toEqual(
          internalSig,
        );
        expect(amphora.findSync({ use: "sig", publish: false })).toEqual(internalSig);

        await expect(amphora.filter({ use: "sig", publish: true })).resolves.toEqual([
          TEST_OKP_KEY_SIG,
        ]);
        expect(amphora.filterSync({ use: "sig", publish: true })).toEqual([
          TEST_OKP_KEY_SIG,
        ]);
        await expect(amphora.find({ use: "sig", publish: true })).resolves.toEqual(
          TEST_OKP_KEY_SIG,
        );
        expect(amphora.findSync({ use: "sig", publish: true })).toEqual(TEST_OKP_KEY_SIG);
      });

      // The general case the boundary normalisation closes, not merely the
      // `publish` instance: an undefined value NEVER widens a lookup, whichever
      // field carries it. A condition with one is exactly the condition without
      // it — same matches, same gate.
      test("should treat an undefined value on any field as absent", async () => {
        amphora.add([internalSig, TEST_OKP_KEY_SIG]);

        await expect(amphora.filter({ use: "sig", purpose: undefined })).resolves.toEqual(
          [TEST_OKP_KEY_SIG],
        );
        expect(amphora.filterSync({ use: "sig", purpose: undefined })).toEqual([
          TEST_OKP_KEY_SIG,
        ]);
        await expect(
          amphora.filter({ use: "sig", issuer: undefined, purpose: undefined }),
        ).resolves.toEqual([TEST_OKP_KEY_SIG]);
      });

      // A condition that is ENTIRELY undefined values is the empty condition,
      // so it must behave as `filter({})` does — gated, not wide open.
      test("should apply the default gate to a condition of only undefined values", async () => {
        amphora.add([internalSig, TEST_OKP_KEY_SIG]);

        await expect(
          amphora.filter({ publish: undefined, purpose: undefined }),
        ).resolves.toEqual(await amphora.filter({}));
      });
    });
  });

  describe("can", () => {
    // A JWKS only ever yields public halves, so this is the shape of every
    // remotely-fetched key.
    // A public-only key as amphora ingests it from a remote JWKS: EXTERNAL
    // (`internal: false`, the `from.jwk` default) and public-half-only.
    const publicOnly = (key: IKryptos) => KryptosKit.from.jwk(key.toJWK("public"));

    const capabilities = () => ({
      canEncrypt: amphora.canEncrypt(),
      canDecrypt: amphora.canDecrypt(),
      canSign: amphora.canSign(),
      canVerify: amphora.canVerify(),
    });

    test("should report no capabilities for an empty vault", () => {
      expect(capabilities()).toMatchSnapshot();
    });

    test("should sign and verify with an asymmetric key holding its private half", () => {
      amphora.add(TEST_RSA_KEY_SIG);

      expect(amphora.canSign()).toBe(true);
      expect(amphora.canVerify()).toBe(true);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should verify but NOT sign with a public-only external sig key", () => {
      const external = publicOnly(TEST_EC_KEY_SIG);

      amphora.add(external);

      expect(external.hasPrivateKey).toBe(false);
      expect(amphora.canVerify()).toBe(true);
      expect(amphora.canSign()).toBe(false);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should encrypt AND decrypt with an oct dir key, which has no public half", () => {
      amphora.add(TEST_OCT_KEY_ENC);

      expect(TEST_OCT_KEY_ENC.hasPublicKey).toBe(false);
      expect(amphora.canEncrypt()).toBe(true);
      expect(amphora.canDecrypt()).toBe(true);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should encrypt but NOT decrypt with a public-only external enc key", () => {
      const external = publicOnly(TEST_RSA_KEY_ENC);

      amphora.add(external);

      expect(external.hasPrivateKey).toBe(false);
      expect(amphora.canEncrypt()).toBe(true);
      expect(amphora.canDecrypt()).toBe(false);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should encrypt and decrypt with an ECDH-ES key holding its private half", () => {
      amphora.add(TEST_EC_KEY_ENC);

      expect(capabilities()).toMatchSnapshot();
    });

    test("should not report sig capabilities for an enc-only vault", () => {
      amphora.add([TEST_EC_KEY_ENC, TEST_OCT_KEY_ENC]);

      expect(amphora.canSign()).toBe(false);
      expect(amphora.canVerify()).toBe(false);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should not report enc capabilities for a sig-only vault", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      expect(amphora.canEncrypt()).toBe(false);
      expect(amphora.canDecrypt()).toBe(false);
      expect(capabilities()).toMatchSnapshot();
    });

    test("should ignore keys that are not active", () => {
      amphora.add(
        KryptosKit.clone(TEST_EC_KEY_SIG, {
          notBefore: new Date("2099-01-01T00:00:00.000Z"),
        }),
      );

      expect(capabilities()).toMatchSnapshot();
    });

    /**
     * ⚠ The regression that produced this suite. A capability is NOT a
     * selection: it asks whether the vault holds a key that can do the work.
     * `publish` says what belongs in our published JWKS — nothing about what we
     * are able to do — so an INTERNAL, UNPUBLISHED key (a KEK, a CA, a cookie or
     * session key: the whole point of `publish: false`) must answer `true` on
     * every one of the four.
     *
     * Through the selection filter it answered `false`, and pylon's session
     * store — gated on `canDecrypt()` and configured with exactly this shape
     * (`{ purpose: "pylon:kek", publish: false }`) — skipped decryption and
     * handed the stored CIPHERTEXT back as the session's access token.
     */
    describe("internal unpublished keys are a capability, not a selection", () => {
      const internal = (key: IKryptos) =>
        KryptosKit.clone(key, { publish: false, purpose: "pylon:kek" });

      test("should report enc capabilities when the ONLY enc key is internal and unpublished", () => {
        const kek = internal(TEST_EC_KEY_ENC);

        amphora.add(kek);

        expect(kek.internal).toBe(true);
        expect(kek.publish).toBe(false);
        expect(kek.hasPrivateKey).toBe(true);

        // Selection still hides it — that gate is unchanged and deliberate.
        expect(amphora.filterSync({ use: "enc" })).toEqual([]);

        expect(amphora.canEncrypt()).toBe(true);
        expect(amphora.canDecrypt()).toBe(true);
        expect(capabilities()).toMatchSnapshot();
      });

      test("should report sig capabilities when the ONLY sig key is internal and unpublished", () => {
        const kek = internal(TEST_RSA_KEY_SIG);

        amphora.add(kek);

        expect(amphora.filterSync({ use: "sig" })).toEqual([]);

        expect(amphora.canSign()).toBe(true);
        expect(amphora.canVerify()).toBe(true);
        expect(capabilities()).toMatchSnapshot();
      });

      // An oct KEK is the shape a deployment reaches for first — no public half
      // at all, so it can never be published and is always internal.
      test("should report enc capabilities for an internal oct dir key", () => {
        amphora.add(internal(TEST_OCT_KEY_ENC));

        expect(amphora.canEncrypt()).toBe(true);
        expect(amphora.canDecrypt()).toBe(true);
        expect(capabilities()).toMatchSnapshot();
      });

      // The gate is dropped, not inverted: an inactive key is still no
      // capability, and a public-only half still cannot do the private-half work.
      test("should still respect activity and key halves for internal keys", () => {
        amphora.add(
          KryptosKit.clone(TEST_EC_KEY_ENC, {
            publish: false,
            purpose: "pylon:kek",
            notBefore: new Date("2099-01-01T00:00:00.000Z"),
          }),
        );

        expect(capabilities()).toMatchSnapshot();
      });
    });
  });

  describe("external config", () => {
    test("should add external config and find jwks", async () => {
      nock("https://lindorm.eu.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, OPEN_ID_CONFIGURATION_RESPONSE);

      nock("https://lindorm.eu.auth0.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, OPEN_ID_JWKS_RESPONSE);

      nock("https://lindorm.jp.auth0.com")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          issuer: "https://lindorm.jp.auth0.io/",
          jwksUri: "https://lindorm.jp.auth0.com/.well-known/jwks.json",
        });

      const okpJwk = TEST_OKP_KEY_ENC.toJWK();
      delete okpJwk.iss;

      nock("https://lindorm.jp.auth0.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [okpJwk] });

      const ecJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete ecJwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [ecJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
          {
            openIdConfigurationUri:
              "https://lindorm.eu.auth0.com/.well-known/openid-configuration",
          },
          {
            issuer: "https://lindorm.jp.auth0.com/",
          },
        ],
      });

      // Before setup the issuer sources are seeded but unfetched. The middle one
      // named no issuer — only a discovery URI — so it is not an issuer yet and
      // is not listed; the two that declared one are.
      expect(
        amphora.external.issuers().map((c) => ({
          issuer: c.issuer,
          keyCount: c.keyCount,
          lastRefresh: c.lastRefresh,
        })),
      ).toEqual([
        {
          issuer: "https://external.lindorm.io/",
          keyCount: 0,
          lastRefresh: null,
        },
        { issuer: "https://lindorm.jp.auth0.com/", keyCount: 0, lastRefresh: null },
      ]);

      await amphora.setup();

      // After setup each source is resolved + enriched: issuer/jwksUri settled
      // (from discovery where needed) and keyCount reflects the fetched keys.
      expect(
        amphora.external.issuers().map((c) => ({
          issuer: c.issuer,
          jwksUri: c.jwksUri,
          keyCount: c.keyCount,
        })),
      ).toEqual([
        {
          issuer: "https://external.lindorm.io/",
          jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          keyCount: 1,
        },
        {
          issuer: "https://lindorm.eu.auth0.com/",
          jwksUri: "https://lindorm.eu.auth0.com/.well-known/jwks.json",
          keyCount: 2,
        },
        {
          issuer: "https://lindorm.jp.auth0.io/",
          jwksUri: "https://lindorm.jp.auth0.com/.well-known/jwks.json",
          keyCount: 1,
        },
      ]);

      // The eu.auth0 source discovered its full OpenID configuration (nested).
      expect(amphora.external.issuers()[1]!.openIdConfiguration?.userinfoEndpoint).toBe(
        "https://lindorm.eu.auth0.com/userinfo",
      );

      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: "EC",
          }),
          expect.objectContaining({
            id: expect.any(String),
            type: "OKP",
          }),
          expect.objectContaining({ id: "iPy9pgzr7cFw1kTuiClWE", type: "RSA" }),
          expect.objectContaining({ id: "IjICkHcf-qq8_stUQ00IN", type: "RSA" }),
        ]),
      );
    });

    test("should add use external config when vault is unable to find key", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer,
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.find({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual(
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      );
    });
  });

  /**
   * ONE issuer rule across all three scopes: a URI, meaning a URL with an
   * authority or a URN. The internal issuer used to be checked with `isUrlLike`
   * while the external one demanded a URI — and `isUrlLike` accepts any
   * `scheme:opaque`, so `foo:bar` passed. That was not merely inconsistent: key
   * resolution scopes a `kid` lookup by issuer ONLY when the issuer is a URI, so
   * an opaque internal issuer booted happily and silently resolved this
   * service's OWN tokens unscoped — the degradation the scoping fix exists to
   * prevent, reachable purely through config.
   */
  describe("issuer validation", () => {
    test("should throw AmphoraError when the issuer is not a valid URL", () => {
      expect(
        () =>
          new Amphora({
            internal: { issuer: "not-a-url" },
            logger: createMockLogger(),
          }),
      ).toThrow(AmphoraError);
    });

    test("should throw AmphoraError with debug context when the issuer is invalid", () => {
      expect(
        () =>
          new Amphora({
            internal: { issuer: "not-a-url" },
            logger: createMockLogger(),
          }),
      ).toThrow(expect.objectContaining({ code: "internal_issuer_not_uri" }));
    });

    // THE hole this rule closes. `new URL("foo:bar")` parses — scheme `foo:`,
    // opaque path `bar`, empty host — so the old URL-like check waved it through.
    test("should reject an opaque scheme:value issuer that carries no authority", () => {
      expect(
        () =>
          new Amphora({
            internal: { issuer: "foo:bar" },
            logger: createMockLogger(),
          }),
      ).toThrow(
        expect.objectContaining({
          code: "internal_issuer_not_uri",
          data: { issuer: "foo:bar" },
        }),
      );
    });

    test("should name both acceptable shapes in the error, not just a URL", () => {
      try {
        new Amphora({ internal: { issuer: "foo:bar" }, logger: createMockLogger() });
        throw new Error("should have thrown");
      } catch (error: any) {
        expect(error.title).toBe("Internal Issuer Not URI");
        expect(error.details).toContain("https://");
        expect(error.details).toContain("urn:");
      }
    });

    // A URN is a URI, so it is a legal issuer on BOTH sides — the case the old
    // "provide a fully-qualified URL" message actively argued against. Guard it:
    // anyone tempted to "fix" this validator back toward URLs breaks it here.
    test("should accept a URN issuer", () => {
      expect(
        () =>
          new Amphora({
            internal: { issuer: "urn:lindorm:test" },
            logger: createMockLogger(),
          }),
      ).not.toThrow();
    });

    test("should reject a malformed URN with no namespace-specific string", () => {
      expect(
        () => new Amphora({ internal: { issuer: "urn:x" }, logger: createMockLogger() }),
      ).toThrow(expect.objectContaining({ code: "internal_issuer_not_uri" }));
    });

    // A URN names the service without saying where to reach it, so nothing
    // derives a JWKS location from it — `null`, not a guess and not a throw.
    test("should derive no jwksUri from a URN issuer", () => {
      const urn = new Amphora({
        internal: { issuer: "urn:lindorm:test" },
        logger: createMockLogger(),
      });

      expect(urn.internal).toEqual({ issuer: "urn:lindorm:test", jwksUri: null });
    });

    test("should stamp a URN issuer on added keys without a jwksUri", () => {
      const urn = new Amphora({
        internal: { issuer: "urn:lindorm:test" },
        logger: createMockLogger(),
      });

      urn.add(KryptosKit.generate.sig.ec({ algorithm: "ES256", publish: true }));

      expect(urn.vault[0]!.issuer).toBe("urn:lindorm:test");
      expect(urn.vault[0]!.jwksUri).toBeNull();
    });

    // A URN is not the only issuer with nowhere to publish. `ftp://example.com`
    // is a URI with an authority, so a path resolves against it happily — into
    // `ftp://example.com/.well-known/jwks.json`, an address no client can fetch.
    // A location is derivable only from an http(s) URL, so this issuer lands in
    // exactly the URN's position: legal, and publishing nothing.
    test.each(["ftp://example.com", "ws://example.com"])(
      "should derive no jwksUri from a non-http URI issuer: %s",
      (issuer) => {
        const instance = new Amphora({
          internal: { issuer },
          logger: createMockLogger(),
        });

        expect(instance.internal).toEqual({ issuer, jwksUri: null });
      },
    );

    test("should stamp a non-http URI issuer on added keys without a jwksUri", () => {
      const instance = new Amphora({
        internal: { issuer: "ftp://example.com" },
        logger: createMockLogger(),
      });

      instance.add(KryptosKit.generate.sig.ec({ algorithm: "ES256", publish: true }));

      expect(instance.vault[0]!.issuer).toBe("ftp://example.com");
      expect(instance.vault[0]!.jwksUri).toBeNull();
    });

    // The scope this whole rule exists to protect: a URI issuer keeps a `kid`
    // lookup narrowed to the keys it actually owns.
    test("should scope a key lookup to the internal issuer", async () => {
      const scoped = new Amphora({
        internal: { issuer: "urn:lindorm:test" },
        logger: createMockLogger(),
      });
      const key = KryptosKit.generate.sig.ec({ algorithm: "ES256", publish: true });

      scoped.add(key);

      await expect(scoped.findById(key.id, "urn:lindorm:test")).resolves.toEqual(
        expect.objectContaining({ id: key.id, issuer: "urn:lindorm:test" }),
      );
      await expect(scoped.findById(key.id, "urn:lindorm:other")).rejects.toThrow(
        expect.objectContaining({ code: "kryptos_not_found_by_id" }),
      );
    });
  });

  /**
   * The `internal` scope — this service's OWN identity. SINGULAR: a service has
   * one identity or none, so this is an object or `null`, never a container that
   * could hold two.
   */
  describe("internal", () => {
    test("should derive the service's own identity from the issuer setting", () => {
      expect(amphora.internal).toEqual({
        issuer,
        jwksUri: new URL("/.well-known/jwks.json", issuer).toString(),
      });
    });

    // The same setting is the filter deciding what the service PUBLISHES, so the
    // block reaching the vault is observable on the wire — not only on the
    // derived accessor.
    test("should publish keys stamped with the internal issuer", () => {
      const instance = new Amphora({ internal: { issuer }, logger: createMockLogger() });
      instance.add(TEST_EC_KEY_SIG);

      expect(instance.jwks.keys.map((key) => key.kid)).toEqual([TEST_EC_KEY_SIG.id]);
    });

    // A verify-only deployment declares no issuer of its own — it mints nothing,
    // so it HAS no identity. That is a fact, not a missing config. The BLOCK is
    // what is omitted; there is no issuer-less `internal` to express.
    test("should be null when no internal block is configured", () => {
      const instance = new Amphora({ logger: createMockLogger() });

      expect(instance.internal).toBeNull();
    });

    test("should throw on jwks when no internal block is configured", () => {
      const instance = new Amphora({ logger: createMockLogger() });

      expect(() => instance.jwks).toThrow(
        expect.objectContaining({ code: "issuer_required_for_jwks" }),
      );
    });
  });

  describe("error context for find()", () => {
    test("should include debug context in error when key not found", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      const promise = amphora.find({ issuer, id: "non-existent-id" });

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          message: "Kryptos not found using query after refresh",
          code: "kryptos_not_found_by_query_after_refresh",
          data: {
            queryKeys: ["issuer", "id"],
            totalKeys: 2,
            activeKeys: 2,
          },
        }),
      );
    });

    // The diagnostics report the EFFECTIVE query — the one that was actually
    // run. An unspecified field never constrained anything, so naming it here
    // would send an operator hunting for a criterion that was never applied.
    test("should not name an unspecified field among the query keys", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      const promise = amphora.find({
        issuer,
        id: "non-existent-id",
        publish: undefined,
        purpose: undefined,
      });

      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          data: expect.objectContaining({ queryKeys: ["issuer", "id"] }),
        }),
      );
    });
  });

  describe("error context for findSync()", () => {
    test("should include debug context in error when key not found", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      expect(() => amphora.findSync({ issuer, id: "non-existent-id" })).toThrow(
        AmphoraError,
      );
      expect(() => amphora.findSync({ issuer, id: "non-existent-id" })).toThrow(
        expect.objectContaining({
          message: "Kryptos not found using query (sync, no refresh)",
          code: "kryptos_not_found_by_query_sync",
          data: {
            queryKeys: ["issuer", "id"],
            totalKeys: 2,
            activeKeys: 2,
          },
        }),
      );
    });
  });

  describe("refresh deduplication", () => {
    test("should deduplicate concurrent refresh calls", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await Promise.all([amphora.refresh(), amphora.refresh(), amphora.refresh()]);

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });
  });

  describe("setup deduplication", () => {
    test("should deduplicate concurrent setup calls", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await Promise.all([amphora.setup(), amphora.setup(), amphora.setup()]);

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });
  });

  describe("lazy setup", () => {
    test("should auto-setup on first filter() call with external providers", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      const result = await amphora.filter({ issuer: "https://external.lindorm.io/" });

      expect(nock.isDone()).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "EC",
            issuer: "https://external.lindorm.io/",
          }),
        ]),
      );
    });

    test("should throw from filterSync when setup not called with external providers", () => {
      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(() => amphora.filterSync({ issuer })).toThrow(AmphoraError);
      expect(() => amphora.filterSync({ issuer })).toThrow(
        "setup() must be called before using sync methods with external providers",
      );
    });

    test("should throw from findSync when setup not called with external providers", () => {
      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(() => amphora.findSync({ issuer, id: "some-id" })).toThrow(AmphoraError);
      expect(() => amphora.findSync({ issuer, id: "some-id" })).toThrow(
        "setup() must be called before using sync methods with external providers",
      );
    });

    test("should not require setup for filter with no external providers", async () => {
      amphora.add(TEST_EC_KEY_SIG);

      await expect(amphora.filter({ issuer, id: TEST_EC_KEY_SIG.id })).resolves.toEqual([
        TEST_EC_KEY_SIG,
      ]);
    });
  });

  describe("config deduplication", () => {
    test("should not duplicate config on repeated refresh", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      expect(amphora.external.issuers().length).toBe(1);

      await amphora.refresh();

      expect(amphora.external.issuers().length).toBe(1);
    });
  });

  describe("external JWKS resilience", () => {
    test("should continue refreshing when one JWKS provider fails", async () => {
      const goodJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete goodJwk.iss;

      nock("https://good-provider.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [goodJwk] });

      nock("https://bad-provider.com")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(500, { error: "Internal Server Error" });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://good-provider.com/",
            jwksUri: "https://good-provider.com/.well-known/jwks.json",
          },
          {
            issuer: "https://bad-provider.com/",
            jwksUri: "https://bad-provider.com/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      expect(amphora.vault).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
            issuer: "https://good-provider.com/",
          }),
        ]),
      );

      const badProviderKeys = amphora.vault.filter(
        (k) => k.issuer === "https://bad-provider.com/",
      );
      expect(badProviderKeys).toHaveLength(0);
    });

    // Declared `required` so the rejection surfaces at setup instead of a warn —
    // the assertion is about WHICH keys the fetch refuses, and the flag is only
    // how that verdict is made visible.
    test("should reject keys with mismatched issuer", async () => {
      const jwkWithWrongIssuer = TEST_EC_KEY_SIG.toJWK("private");
      jwkWithWrongIssuer.iss = "https://attacker.com/";

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwkWithWrongIssuer] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      const promise = amphora.setup();

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "external_jwks_issuer_mismatch" }),
      );

      const externalKeys = amphora.vault.filter(
        (k) => k.issuer === "https://external.lindorm.io/",
      );
      expect(externalKeys).toHaveLength(0);
    });

    test("should truncate when provider returns too many keys", async () => {
      const jwk1 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-1" };
      const jwk2 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-2" };
      const jwk3 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-3" };
      const jwk4 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-4" };
      const jwk5 = { ...TEST_EC_KEY_SIG.toJWK("private"), kid: "key-5" };

      delete jwk1.iss;
      delete jwk2.iss;
      delete jwk3.iss;
      delete jwk4.iss;
      delete jwk5.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk1, jwk2, jwk3, jwk4, jwk5] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxExternalKeys: 2,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      const externalKeys = amphora.vault.filter(
        (k) => k.issuer === "https://external.lindorm.io/",
      );
      expect(externalKeys).toHaveLength(2);
    });

    test("should preserve locally-added keys during external refresh", async () => {
      const localKey = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://external.lindorm.io/",
      });

      const externalJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete externalJwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [externalJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      amphora.add(localKey);

      await amphora.setup();

      const localKeyInVault = amphora.vault.find((k) => k.id === localKey.id);
      expect(localKeyInVault).toBeDefined();
      expect(localKeyInVault?.issuer).toBe("https://external.lindorm.io/");
      expect(localKeyInVault?.internal).toBe(true);

      const externalKeyInVault = amphora.vault.find((k) => k.id === TEST_EC_KEY_SIG.id);
      expect(externalKeyInVault).toBeDefined();
      expect(externalKeyInVault?.issuer).toBe("https://external.lindorm.io/");
      expect(externalKeyInVault?.internal).toBe(false);
    });

    // We publish OUR keys and only ours. The adversarial case is a provider whose
    // issuer is OUR OWN: every other refreshJwks filter then passes — the
    // key is public, unexpired, and lands with `publish: true` (a JWK is the
    // interchange format of a published key) — so `internal: true` is the ONLY
    // thing keeping someone else's key material out of the JWKS we serve as ours.
    test("should never publish an external key in our own jwks", async () => {
      const externalJwk = TEST_EC_KEY_SIG.toJWK("public");
      delete externalJwk.iss;
      // Adversarial: the served key EXPLICITLY claims it is publishable. Even so,
      // `internal: false` (decided by the import path, never the payload) is what
      // keeps it out of our JWKS — not its `publish` value.
      externalJwk.publish = true;

      nock("https://test.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [externalJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer,
            jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      // It is in the vault, it claims our issuer, and it is publishable...
      const external = amphora.vault.find((k) => k.id === TEST_EC_KEY_SIG.id);
      expect(external?.issuer).toBe(issuer);
      expect(external?.publish).toBe(true);
      expect(external?.internal).toBe(false);

      // ...and it is still NOT in our JWKS.
      expect(amphora.jwks.keys.some((k) => k.kid === TEST_EC_KEY_SIG.id)).toBe(false);
    });
  });

  describe("external JWKS unparseable keys", () => {
    const externalIssuer = "https://external.lindorm.io/";
    const externalJwksUri = "https://external.lindorm.io/.well-known/jwks.json";

    // A valid, parseable public JWK from the fixture key, without its iss claim
    // (the JWKS endpoint is the issuer, the key does not repeat it).
    const validJwk = (kid: string): Record<string, unknown> => {
      const jwk: Record<string, unknown> = { ...TEST_EC_KEY_SIG.toJWK("public"), kid };
      delete jwk.iss;
      return jwk;
    };

    // alg is OPTIONAL per RFC 7517 §4.4 and routinely omitted by stock OPs, but
    // kryptos requires it — so this key throws on parse.
    const unparseableJwk = (kid: string): Record<string, unknown> => {
      const jwk = validJwk(kid);
      delete jwk.alg;
      return jwk;
    };

    // `required` so a fetch that rejects every key surfaces AT setup rather than
    // as a warn — these cases are about the per-issuer verdict, and the flag is
    // only what makes it visible to the caller.
    const createScoped = (logger: ReturnType<typeof createMockLogger>) =>
      new Amphora({
        internal: { issuer },
        logger,
        external: [{ required: true, issuer: externalIssuer, jwksUri: externalJwksUri }],
      });

    test("should skip the unparseable key and still load the issuer's other keys", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, {
          keys: [
            validJwk("key-good-1"),
            unparseableJwk("key-no-alg"),
            validJwk("key-good-2"),
          ],
        });

      amphora = createScoped(createMockLogger());

      await amphora.setup();

      const keys = amphora.vault.filter((k) => k.issuer === externalIssuer);

      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.id).sort()).toEqual(["key-good-1", "key-good-2"]);
    });

    test("should warn with the kid of the skipped key", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [validJwk("key-good-1"), unparseableJwk("key-no-alg")] });

      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      amphora = createScoped(logger);

      await amphora.setup();

      expect(child.warn).toHaveBeenCalledWith(
        "External JWK rejected: key could not be parsed",
        expect.objectContaining({
          issuer: externalIssuer,
          kid: "key-no-alg",
          error: expect.any(String),
        }),
      );
    });

    test("should throw external_jwks_all_unusable when every key is unparseable", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, {
          keys: [unparseableJwk("key-no-alg-1"), unparseableJwk("key-no-alg-2")],
        });

      amphora = createScoped(createMockLogger());

      const promise = amphora.setup();

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          code: "external_jwks_all_unusable",
          data: {
            issuer: externalIssuer,
            total: 2,
            rejected: 0,
            expired: 0,
            rejectedByTrust: 0,
            unusable: 2,
          },
        }),
      );
    });

    test("should throw when the only keys are unparseable and expired, never return an empty set", async () => {
      const expired = { ...validJwk("key-expired"), exp: 1000000000 };

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [unparseableJwk("key-no-alg"), expired] });

      amphora = createScoped(createMockLogger());

      const promise = amphora.setup();

      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          code: "external_jwks_no_valid_keys",
          data: {
            issuer: externalIssuer,
            total: 2,
            rejected: 0,
            expired: 1,
            rejectedByTrust: 0,
            unusable: 1,
          },
        }),
      );

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should report per-cause counts when unparseable and issuer-mismatched keys mix", async () => {
      const mismatched = { ...validJwk("key-mismatch"), iss: "https://attacker.com/" };

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [unparseableJwk("key-no-alg"), mismatched] });

      amphora = createScoped(createMockLogger());

      await expect(amphora.setup()).rejects.toThrow(
        expect.objectContaining({
          code: "external_jwks_no_valid_keys",
          data: {
            issuer: externalIssuer,
            total: 2,
            rejected: 1,
            expired: 0,
            rejectedByTrust: 0,
            unusable: 1,
          },
        }),
      );
    });

    test("should load a fully valid JWKS unaffected", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [validJwk("key-good-1"), validJwk("key-good-2")] });

      amphora = createScoped(createMockLogger());

      await amphora.setup();

      const keys = amphora.vault.filter((k) => k.issuer === externalIssuer);

      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.id).sort()).toEqual(["key-good-1", "key-good-2"]);
    });
  });

  describe("encapsulation", () => {
    test("should not allow mutation of vault via getter", () => {
      amphora.add(TEST_EC_KEY_SIG);
      const vault = amphora.vault;
      vault.push(TEST_OKP_KEY_SIG);
      expect(amphora.vault).toHaveLength(1);
    });

    test("should not allow mutation of the internal config via getter", () => {
      const config = amphora.internal!;
      config.issuer = "https://tampered.lindorm.io/";

      expect(amphora.internal!.issuer).toBe(issuer);
    });

    test("should not allow mutation of external issuers via getter", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      const issuers = amphora.external.issuers();
      issuers.length = 0;

      expect(amphora.external.issuers()).toHaveLength(1);
    });

    test("should not allow mutation of jwks keys via getter", () => {
      amphora.add(TEST_EC_KEY_SIG);
      const jwks = amphora.jwks;
      jwks.keys.length = 0;
      expect(amphora.jwks.keys).toHaveLength(1);
    });
  });

  describe("x509 certificate chain", () => {
    test("should emit x5c and x5t#S256 in JWKS for kryptos with chain", () => {
      amphora.add(TEST_X509_KRYPTOS_SIG);

      expect(amphora.jwks).toMatchSnapshot();
    });

    test("should filter kryptos by certificateThumbprint", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_X509_KRYPTOS_SIG]);

      await expect(
        amphora.filter({
          certificateThumbprint: TEST_X509_KRYPTOS_SIG.certificateThumbprint,
        }),
      ).resolves.toEqual([TEST_X509_KRYPTOS_SIG]);
    });

    test("should return empty array when filtering by unknown thumbprint", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_X509_KRYPTOS_SIG]);

      await expect(
        amphora.filter({ certificateThumbprint: "unknown-thumbprint-value" }),
      ).resolves.toEqual([]);
    });

    test("should return empty array when filtering by thumbprint on chain-less vault", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      await expect(
        amphora.filter({ certificateThumbprint: "some-thumbprint" }),
      ).resolves.toEqual([]);
    });
  });

  describe("cache freshness", () => {
    afterEach(() => {
      MockDate.set(MockedDate);
    });

    test("should refresh stale vault even on cache hit", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        refreshInterval: 100,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      const result = await amphora.filter({ issuer: "https://external.lindorm.io/" });

      expect(nock.isDone()).toBe(true);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });

    test("should not refresh non-stale cache on hit", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        refreshInterval: 300_000,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      const result = await amphora.filter({ issuer: "https://external.lindorm.io/" });

      expect(nock.isDone()).toBe(true);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });

    test("should return stale results from filterSync without refreshing", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        refreshInterval: 100,
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      const result = amphora.filterSync({ issuer: "https://external.lindorm.io/" });

      expect(nock.isDone()).toBe(true);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: TEST_EC_KEY_SIG.id,
            type: "EC",
          }),
        ]),
      );
    });
  });

  // A stale refetch is an OPTIMISATION, so its failure must not deny a caller we
  // can already answer — while a MISS refetch is the only thing that can produce
  // an answer at all, so its failure must keep propagating its real cause. Both
  // directions are pinned here: a test for the first alone would let the guard be
  // "simplified" into swallowing miss failures too, which turns a 503 into a
  // generic not-found and hides the outage.
  describe("stale refresh failure vs miss failure", () => {
    const staleIssuer = "https://stale.lindorm.io/";
    const staleJwksUri = "https://stale.lindorm.io/.well-known/jwks.json";

    const publicJwk = () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    // The endpoint answers once (setup), then is down for good. `times` is not
    // usable for the down half: the conduit retries a 5xx, so one logical load
    // consumes several interceptors.
    const downAfterOneGoodFetch = () => {
      nock("https://stale.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      nock("https://stale.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(503, { error: "Service Unavailable" });
    };

    const staleAmphora = (logger = createMockLogger()) =>
      new Amphora({
        internal: { issuer },
        logger,
        refreshInterval: 100,
        external: [{ issuer: staleIssuer, jwksUri: staleJwksUri }],
      });

    afterEach(() => {
      nock.cleanAll();
      MockDate.set(MockedDate);
    });

    test("filter serves the cached keys when only the STALE refetch failed", async () => {
      downAfterOneGoodFetch();

      amphora = staleAmphora();
      await amphora.setup();

      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      const result = await amphora.filter({ issuer: staleIssuer });

      expect(result).toEqual([
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id, issuer: staleIssuer }),
      ]);
    });

    test("find serves the cached key when only the STALE refetch failed", async () => {
      downAfterOneGoodFetch();

      amphora = staleAmphora();
      await amphora.setup();

      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      const result = await amphora.find({ issuer: staleIssuer, use: "sig" });

      expect(result.id).toBe(TEST_EC_KEY_SIG.id);
    });

    test("a swallowed stale refetch is logged at debug, not warn or error", async () => {
      downAfterOneGoodFetch();

      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      amphora = staleAmphora(logger);
      await amphora.setup();

      vi.mocked(child.debug).mockClear();
      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      await amphora.filter({ issuer: staleIssuer });

      expect(child.debug).toHaveBeenCalledWith(
        "Stale refresh failed; serving cached keys",
        expect.objectContaining({ issuer: staleIssuer }),
      );
    });

    // Serving from cache IS use. Without this the one lookup per backoff window
    // that takes the swallow path leaves the entry looking idle, so an issuer in
    // active use becomes the eviction victim while its endpoint is down — and
    // eviction is final.
    test("serving from cache on a swallowed refetch still counts as an access", async () => {
      nock(/lindorm\.io/)
        .persist()
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [publicJwk()] });

      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxIssuers: 2,
        refreshInterval: 100,
      });

      MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
      await instance.external.addIssuer({ issuer: staleIssuer, jwksUri: staleJwksUri });

      MockDate.set(new Date("2024-01-01T08:00:01.000Z"));
      await instance.external.addIssuer({
        issuer: "https://idle.lindorm.io/",
        jwksUri: "https://idle.lindorm.io/.well-known/jwks.json",
      });

      // The stale issuer's endpoint goes down, then it is USED — the refetch is
      // swallowed and the cached key is served.
      nock.cleanAll();
      nock("https://stale.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(503, { error: "Service Unavailable" });
      nock("https://new.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [publicJwk()] });

      MockDate.set(new Date("2024-01-01T08:00:02.000Z"));
      await instance.filter({ issuer: staleIssuer });

      MockDate.set(new Date("2024-01-01T08:00:03.000Z"));
      await instance.external.addIssuer({
        issuer: "https://new.lindorm.io/",
        jwksUri: "https://new.lindorm.io/.well-known/jwks.json",
      });

      const issuers = instance.external.issuers().map((c) => c.issuer);

      expect(issuers).toContain(staleIssuer);
      expect(issuers).not.toContain("https://idle.lindorm.io/");
    });

    test("filter propagates the real cause when the MISS refetch failed", async () => {
      nock("https://stale.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(503, { error: "Service Unavailable" });

      amphora = staleAmphora();
      await amphora.setup();

      expect(amphora.vault.filter((k) => k.issuer === staleIssuer)).toHaveLength(0);

      const error = await amphora
        .filter({ issuer: staleIssuer, use: "sig" })
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(AmphoraError);
      expect(error).toEqual(expect.objectContaining({ status: 503 }));
    });

    // `find` delegates to `filter`, so the miss refetch throws before `find`
    // reaches its own not-found. That ordering is the point: a 503 must not be
    // reported as "no key matched".
    test("find propagates the real cause rather than its not-found on a failed MISS refetch", async () => {
      nock("https://stale.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(503, { error: "Service Unavailable" });

      amphora = staleAmphora();
      await amphora.setup();

      const error = await amphora
        .find({ issuer: staleIssuer, use: "sig" })
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toEqual(expect.objectContaining({ status: 503 }));
      expect(error).not.toEqual(
        expect.objectContaining({ code: "kryptos_not_found_by_query_after_refresh" }),
      );
    });

    // `findById` has no cached answer to fall back on by construction — the id
    // was not in the vault — so R7 does not reach it and its real cause stands.
    test("findById propagates the real cause on a failed refetch", async () => {
      nock("https://stale.lindorm.io")
        .persist()
        .get("/.well-known/jwks.json")
        .reply(503, { error: "Service Unavailable" });

      amphora = staleAmphora();
      await amphora.setup();

      const error = await amphora
        .findById("no-such-kid", staleIssuer)
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toEqual(expect.objectContaining({ status: 503 }));
      expect(error).not.toBeInstanceOf(AmphoraError);
    });

    // The sync readers never refresh, so there is nothing to swallow: a stale
    // cached key is served exactly as before.
    test("filterSync is untouched by the swallow and still serves stale keys", async () => {
      downAfterOneGoodFetch();

      amphora = staleAmphora();
      await amphora.setup();

      MockDate.set(new Date("2024-01-01T08:00:00.200Z"));

      expect(amphora.filterSync({ issuer: staleIssuer })).toEqual([
        expect.objectContaining({ id: TEST_EC_KEY_SIG.id }),
      ]);
    });
  });

  describe("external trust anchors", () => {
    const externalIssuer = "https://external.lindorm.io/";
    const externalJwksUri = "https://external.lindorm.io/.well-known/jwks.json";

    const generateCa = () =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
        certificate: { mode: "root-ca" },
      });

    const generateChild = (ca: ReturnType<typeof generateCa>) =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
        certificate: { mode: "ca-signed", ca },
      });

    test("should accept externally-fetched key signed by configured trust anchor", async () => {
      const ca = generateCa();
      const child = generateChild(ca);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
          },
        ],
      });

      await amphora.setup();

      const accepted = await amphora.filter({ issuer: externalIssuer });
      expect(accepted).toHaveLength(1);
      expect(accepted[0]!.id).toBe(child.id);
    });

    test("should accept trust anchors as an array of strings", async () => {
      const caA = generateCa();
      const caB = generateCa();
      const child = generateChild(caB);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: [caA.certificateChain[0], caB.certificateChain[0]],
          },
        ],
      });

      await amphora.setup();

      const accepted = await amphora.filter({ issuer: externalIssuer });
      expect(accepted).toHaveLength(1);
      expect(accepted[0]!.id).toBe(child.id);
    });

    test("should reject externally-fetched key signed by a different CA", async () => {
      const trustedCa = generateCa();
      const untrustedCa = generateCa();
      const child = generateChild(untrustedCa);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(
        expect.objectContaining({ code: "external_jwks_all_rejected_by_trust" }),
      );

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should reject externally-fetched key without certificate chain when anchors required", async () => {
      const ca = generateCa();
      const chainless = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
      });
      const jwk = chainless.toJWK("public");
      delete jwk.iss;
      expect(jwk.x5c).toBeUndefined();

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should include rejectedByTrust in the error data when all keys fail trust validation", async () => {
      const trustedCa = generateCa();
      const untrustedCa = generateCa();
      const child = generateChild(untrustedCa);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
          },
        ],
      });

      const promise = amphora.setup();

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          code: "external_jwks_all_rejected_by_trust",
          data: expect.objectContaining({ rejectedByTrust: 1, total: 1 }),
        }),
      );
    });

    test("should evaluate mixed trusted and untrusted issuers independently", async () => {
      const ca = generateCa();
      const trustedChild = generateChild(ca);
      const trustedJwk = trustedChild.toJWK("public");
      delete trustedJwk.iss;

      const looseJwk = TEST_EC_KEY_SIG.toJWK("private");
      delete looseJwk.iss;

      nock("https://trusted.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [trustedJwk] });

      nock("https://loose.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [looseJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://trusted.lindorm.io/",
            jwksUri: "https://trusted.lindorm.io/.well-known/jwks.json",
            trustAnchors: ca.certificateChain[0],
          },
          {
            issuer: "https://loose.lindorm.io/",
            jwksUri: "https://loose.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();

      const trusted = await amphora.filter({
        issuer: "https://trusted.lindorm.io/",
      });
      const loose = await amphora.filter({
        issuer: "https://loose.lindorm.io/",
      });

      expect(trusted).toHaveLength(1);
      expect(trusted[0]!.id).toBe(trustedChild.id);
      expect(loose).toHaveLength(1);
      expect(loose[0]!.id).toBe(TEST_EC_KEY_SIG.id);
    });
  });

  describe("external trust mode", () => {
    const externalIssuer = "https://external.lindorm.io/";
    const externalJwksUri = "https://external.lindorm.io/.well-known/jwks.json";

    const generateCa = () =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
        certificate: { mode: "root-ca" },
      });

    const generateChild = (ca: ReturnType<typeof generateCa>) =>
      KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
        certificate: { mode: "ca-signed", ca },
      });

    test("should accept cert-less key when trustMode is lax", async () => {
      const ca = generateCa();
      const chainless = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
      });
      const jwk = chainless.toJWK("public");
      delete jwk.iss;
      expect(jwk.x5c).toBeUndefined();

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
            trustMode: "lax",
          },
        ],
      });

      await amphora.setup();

      const accepted = await amphora.filter({ issuer: externalIssuer });
      expect(accepted).toHaveLength(1);
      expect(accepted[0]!.id).toBe(chainless.id);
    });

    test("should accept ca-signed key with valid anchor when trustMode is lax", async () => {
      const ca = generateCa();
      const child = generateChild(ca);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
            trustMode: "lax",
          },
        ],
      });

      await amphora.setup();

      const accepted = await amphora.filter({ issuer: externalIssuer });
      expect(accepted).toHaveLength(1);
      expect(accepted[0]!.id).toBe(child.id);
    });

    test("should reject ca-signed key with wrong anchor even when trustMode is lax", async () => {
      const trustedCa = generateCa();
      const untrustedCa = generateCa();
      const child = generateChild(untrustedCa);
      const jwk = child.toJWK("public");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
            trustMode: "lax",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(
        expect.objectContaining({ code: "external_jwks_all_rejected_by_trust" }),
      );

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should reject cert-less key when trustMode is explicitly strict", async () => {
      const ca = generateCa();
      const chainless = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: externalIssuer,
      });
      const jwk = chainless.toJWK("public");
      delete jwk.iss;
      expect(jwk.x5c).toBeUndefined();

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            required: true,
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
            trustMode: "strict",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should evaluate per-issuer trust mode independently", async () => {
      const ca = generateCa();

      const laxChainless = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://lax.lindorm.io/",
      });
      const laxJwk = laxChainless.toJWK("public");
      delete laxJwk.iss;

      const strictChainless = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://strict.lindorm.io/",
      });
      const strictJwk = strictChainless.toJWK("public");
      delete strictJwk.iss;

      nock("https://lax.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [laxJwk] });

      nock("https://strict.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [strictJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://lax.lindorm.io/",
            jwksUri: "https://lax.lindorm.io/.well-known/jwks.json",
            trustAnchors: ca.certificateChain[0],
            trustMode: "lax",
          },
          {
            issuer: "https://strict.lindorm.io/",
            jwksUri: "https://strict.lindorm.io/.well-known/jwks.json",
            trustAnchors: ca.certificateChain[0],
            trustMode: "strict",
          },
        ],
      });

      await amphora.setup();

      const laxKeys = amphora.vault.filter((k) => k.issuer === "https://lax.lindorm.io/");
      const strictKeys = amphora.vault.filter(
        (k) => k.issuer === "https://strict.lindorm.io/",
      );

      expect(laxKeys).toHaveLength(1);
      expect(laxKeys[0]!.id).toBe(laxChainless.id);
      expect(strictKeys).toHaveLength(0);
    });
  });

  describe("external facet — keys", () => {
    test("external.add forces internal:false and does not stamp the amphora issuer", () => {
      const key = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://foreign.lindorm.io/",
      });
      expect(key.internal).toBe(true);

      amphora.external.add(key);

      const stored = amphora.findByIdSync(key.id);
      expect(stored.internal).toBe(false);
      // Foreign issuer preserved — never overwritten with the amphora issuer.
      expect(stored.issuer).toBe("https://foreign.lindorm.io/");
    });

    test("external.add accepts an array and never publishes foreign keys in our jwks", () => {
      const a = KryptosKit.from.jwk({ ...TEST_EC_KEY_SIG.toJWK("public"), iss: issuer });
      const b = KryptosKit.from.jwk(TEST_OKP_KEY_SIG.toJWK("public"));

      amphora.external.add([a, b]);

      expect(amphora.vault).toHaveLength(2);
      // Even though `a` claims OUR issuer, it is external provenance, so it is
      // never served as ours.
      expect(amphora.jwks.keys.some((k) => k.kid === a.id)).toBe(false);
    });

    // Updated for the required `issuer`: a kid is unique only PER ISSUER, so
    // naming one is the only way to say WHICH key is meant.
    test("external.remove drops a key by id under its issuer", () => {
      const key = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://foreign.lindorm.io/",
      });
      amphora.external.add(key);
      expect(amphora.vault.find((k) => k.id === key.id)).toBeDefined();

      amphora.external.remove(key.id, "https://foreign.lindorm.io/");
      expect(amphora.vault.find((k) => k.id === key.id)).toBeUndefined();
    });

    // A FOREIGN key carries its own identity or it has none we may invent. There
    // is no fallback issuer to stamp — using ours would claim someone else's key
    // as our own — so an issuer-less foreign key is rejected outright, mirroring
    // the guard the internal side already has.
    test("external.add rejects a foreign key that carries no issuer", () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      const issuerless = KryptosKit.from.jwk(jwk);
      expect(issuerless.issuer).toBeNull();

      expect(() => amphora.external.add(issuerless)).toThrow(
        expect.objectContaining({
          code: "kryptos_issuer_required",
          data: expect.objectContaining({ id: issuerless.id }),
        }),
      );
      expect(amphora.vault).toHaveLength(0);
    });
  });

  // A key id is unique PER ISSUER — the same invariant `findByIdExact` throws
  // `kryptos_ambiguous_id` on. Dedupe has to agree: keyed on the bare id, adding
  // OUR key under a kid two peers also use DELETED both peers' keys.
  describe("vault dedupe is scoped to (id, issuer)", () => {
    const issuerA = "https://iss-a.lindorm.io/";
    const issuerB = "https://iss-b.lindorm.io/";

    const foreign = (source: IKryptos, id: string, keyIssuer: string): IKryptos =>
      KryptosKit.clone(source, { id, issuer: keyIssuer, internal: false });

    test("adding OUR key with a colliding kid leaves both peers' keys intact", () => {
      amphora.external.add([
        foreign(TEST_EC_KEY_SIG, "kid-1", issuerA),
        foreign(TEST_OKP_KEY_SIG, "kid-1", issuerB),
      ]);

      amphora.add(KryptosKit.clone(TEST_RSA_KEY_SIG, { id: "kid-1", issuer }));

      expect(amphora.vault).toHaveLength(3);
      expect(amphora.findByIdSync("kid-1", issuerA).type).toBe("EC");
      expect(amphora.findByIdSync("kid-1", issuerB).type).toBe("OKP");
      expect(amphora.findByIdSync("kid-1", issuer).type).toBe("RSA");
    });

    test("two foreign issuers sharing a kid coexist through external.add", () => {
      amphora.external.add(foreign(TEST_EC_KEY_SIG, "kid-1", issuerA));
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", issuerB));

      expect(amphora.vault).toHaveLength(2);
      expect(amphora.findByIdSync("kid-1", issuerA).type).toBe("EC");
      expect(amphora.findByIdSync("kid-1", issuerB).type).toBe("OKP");
    });

    // The other half: scoping the dedupe must not stop a genuine ROTATION from
    // replacing the key it rotates.
    test("add replaces a key with the same id under the SAME issuer", () => {
      amphora.add(KryptosKit.clone(TEST_EC_KEY_SIG, { id: "kid-1", issuer }));
      amphora.add(KryptosKit.clone(TEST_OKP_KEY_SIG, { id: "kid-1", issuer }));

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync("kid-1", issuer).type).toBe("OKP");
    });

    test("external.add replaces a key with the same id under the SAME issuer", () => {
      amphora.external.add(foreign(TEST_EC_KEY_SIG, "kid-1", issuerA));
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", issuerA));

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync("kid-1", issuerA).type).toBe("OKP");
    });
  });

  // Removal answers to the SAME per-issuer uniqueness the add side does. Keyed
  // on the bare id it dropped the kid from EVERY issuer at once — the mirror of
  // the dedupe bug above, and the exact ambiguity `findByIdExact` refuses to
  // guess at (`kryptos_ambiguous_id`). Naming the issuer is the caller's answer.
  describe("external.remove is scoped to (id, issuer)", () => {
    const issuerA = "https://iss-a.lindorm.io/";
    const issuerB = "https://iss-b.lindorm.io/";

    const foreign = (source: IKryptos, id: string, keyIssuer: string): IKryptos =>
      KryptosKit.clone(source, { id, issuer: keyIssuer, internal: false });

    // ⚠ The fixture keys expire 2024-06-01 in REAL time, so every test here
    // needs the frozen clock a preceding block may have moved.
    beforeEach(() => {
      MockDate.set(MockedDate);
    });

    afterEach(() => {
      MockDate.set(MockedDate);
    });

    test("removes only the named issuer's key when two peers share a kid", () => {
      amphora.external.add([
        foreign(TEST_EC_KEY_SIG, "kid-1", issuerA),
        foreign(TEST_OKP_KEY_SIG, "kid-1", issuerB),
      ]);

      amphora.external.remove("kid-1", issuerA);

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync("kid-1", issuerB).type).toBe("OKP");
      expect(amphora.vault.find((k) => k.issuer === issuerA)).toBeUndefined();
    });

    test("removing a kid under an issuer that does not hold it is a no-op", () => {
      amphora.external.add([
        foreign(TEST_EC_KEY_SIG, "kid-1", issuerA),
        foreign(TEST_OKP_KEY_SIG, "kid-2", issuerB),
      ]);

      const before = amphora.vault;

      amphora.external.remove("kid-1", issuerB);

      expect(amphora.vault).toEqual(before);
      expect(amphora.findByIdSync("kid-1", issuerA).type).toBe("EC");
      expect(amphora.findByIdSync("kid-2", issuerB).type).toBe("OKP");
    });

    // A foreign key is never IN our jwks, so the refresh has to be observed
    // through what a recompute would change: an internal published key that has
    // since expired stays in the cached listing until something recomputes it.
    test("refreshes the jwks after removing", () => {
      amphora.add(TEST_EC_KEY_SIG);
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", issuerA));

      expect(amphora.jwks.keys).toHaveLength(1);

      // Past the fixture's `expiresAt` — the cached listing is now stale.
      MockDate.set(new Date("2024-07-01T08:00:00.000Z"));
      expect(amphora.jwks.keys).toHaveLength(1);

      amphora.external.remove("kid-1", issuerA);

      expect(amphora.jwks.keys).toHaveLength(0);
    });
  });

  // ONE provenance rule, both ID-SCOPED writers, both directions: a vault write
  // must not cross provenance. The vault partitions by `internal`, and a slot is
  // `(id, issuer)` — so one of OUR keys and a foreign key can never share one.
  //
  // ⚠ The rule keys on `internal`, NEVER on the issuer. A foreign key may
  // legitimately carry OUR issuer (the last two tests here), so "the issuer is
  // ours" says nothing about whose key it is; only the flag does.
  //
  // The crossing case THROWS. Skipping would make a failed removal
  // indistinguishable from a successful one, and letting the two coexist is
  // worse: they would share the one `(id, issuer)` slot both writers treat as
  // unique, so `findByIdExact` would see two matches and throw
  // `kryptos_ambiguous_id` at LOOKUP time — punishing a read that did nothing
  // wrong.
  describe("vault writes cannot cross provenance", () => {
    const foreignIssuer = "https://foreign.lindorm.io/";

    // The env string from the `env` block above — an EC key whose kid is below,
    // carrying no issuer, so `env` files it under OURS as `internal: true`.
    const envKey =
      "kryptos:eyJlbmMiOiJBMTkyR0NNIiwiaWF0IjoxNzQ0NzA0MjYzLCJrZXlfb3BzIjpbImRlcml2ZUtleSJdLCJuYmYiOjE3NDQ3MDQyNjMsInB1cnBvc2UiOiJ0ZXN0IiwidWF0IjoxNzQ0NzA0MjYzLCJjcnYiOiJQLTM4NCIsIngiOiJGMTgyVlNMMURyRll5b19feVJ3eXlvS3JtT08wVEU0MktxT0pOQk1CNlgxSlFYbGV1MTVqYVpsN3dHdG5XcmxUIiwieSI6IlM3bElSZG45dlh5QnF4S0FSUTZzampLcXlCekt1T3VJM1BYcExlUEZ3bmpXNDduWEVVN2hDMzNydmF5ZzVZbVkiLCJkIjoiVzlRNmZMc2J2NkN0dk1zWUUyOTJha2VqeUlZeHFUY1BGSTQzUE9Fd1dpeVRrMFhhelk4NEREQnpHZlNVNEhmOCIsImtpZCI6IjE2NmM2YWI2LWRmOWYtNGZkYS1hYWI4LTkyMTM5ZWY2NDc5MiIsImFsZyI6IkVDREgtRVMrQTE5MktXIiwidXNlIjoiZW5jIiwia3R5IjoiRUMifQ";
    const envKeyId = "166c6ab6-df9f-4fda-aab8-92139ef64792";

    const ours = (source: IKryptos, id: string, keyIssuer: string): IKryptos =>
      KryptosKit.clone(source, { id, issuer: keyIssuer, internal: true });

    const foreign = (source: IKryptos, id: string, keyIssuer: string): IKryptos =>
      KryptosKit.clone(source, { id, issuer: keyIssuer, internal: false });

    // ⚠ The fixture keys expire 2024-06-01 in REAL time, so every test here
    // needs the frozen clock a preceding block may have moved.
    beforeEach(() => {
      MockDate.set(MockedDate);
    });

    afterEach(() => {
      MockDate.set(MockedDate);
    });

    test("external.remove refuses to delete one of OUR keys, which survives", () => {
      amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer));

      expect(() => amphora.external.remove("kid-1", issuer)).toThrow(
        expect.objectContaining({
          code: "kryptos_provenance_conflict",
          data: expect.objectContaining({
            id: "kid-1",
            issuer,
            held: "internal",
            attempted: "external",
          }),
        }),
      );

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync("kid-1", issuer).internal).toBe(true);
    });

    test("external.add refuses to replace one of OUR keys, which survives unmodified", () => {
      amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer));

      expect(() =>
        amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", issuer)),
      ).toThrow(
        expect.objectContaining({
          code: "kryptos_provenance_conflict",
          data: expect.objectContaining({ held: "internal", attempted: "external" }),
        }),
      );

      expect(amphora.vault).toHaveLength(1);

      const held = amphora.findByIdSync("kid-1", issuer);
      expect(held.internal).toBe(true);
      expect(held.type).toBe("EC");
    });

    test("add refuses to replace a FOREIGN key, which survives unmodified", () => {
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", issuer));

      expect(() => amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer))).toThrow(
        expect.objectContaining({
          code: "kryptos_provenance_conflict",
          data: expect.objectContaining({ held: "external", attempted: "internal" }),
        }),
      );

      expect(amphora.vault).toHaveLength(1);

      const held = amphora.findByIdSync("kid-1", issuer);
      expect(held.internal).toBe(false);
      expect(held.type).toBe("OKP");
    });

    test("env refuses to replace a FOREIGN key holding the imported key's slot", () => {
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, envKeyId, issuer));

      expect(() => amphora.env(envKey)).toThrow(
        expect.objectContaining({
          code: "kryptos_provenance_conflict",
          data: expect.objectContaining({
            id: envKeyId,
            issuer,
            held: "external",
            attempted: "internal",
          }),
        }),
      );

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync(envKeyId, issuer).internal).toBe(false);
    });

    // The other half of the rule — it must not touch a SAME-provenance write,
    // which is an ordinary rotation in both directions.
    test("add replaces one of OUR keys under the same slot", () => {
      amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer));
      amphora.add(ours(TEST_OKP_KEY_SIG, "kid-1", issuer));

      expect(amphora.vault).toHaveLength(1);

      const held = amphora.findByIdSync("kid-1", issuer);
      expect(held.internal).toBe(true);
      expect(held.type).toBe("OKP");
    });

    test("external.add replaces a FOREIGN key under the same slot", () => {
      amphora.external.add(foreign(TEST_EC_KEY_SIG, "kid-1", foreignIssuer));
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-1", foreignIssuer));

      expect(amphora.vault).toHaveLength(1);

      const held = amphora.findByIdSync("kid-1", foreignIssuer);
      expect(held.internal).toBe(false);
      expect(held.type).toBe("OKP");
    });

    // ⚠ THE test that stops the rule being "simplified" into an issuer
    // comparison. A foreign key may carry OUR issuer — `external.add` accepts
    // one and must — and a different id is a different slot, so nothing crosses.
    test("external.add accepts a foreign key under OUR issuer at a different id", () => {
      amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer));

      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-2", issuer));

      expect(amphora.vault).toHaveLength(2);
      expect(amphora.findByIdSync("kid-1", issuer).internal).toBe(true);
      expect(amphora.findByIdSync("kid-2", issuer).internal).toBe(false);
    });

    test("external.remove drops a foreign key that carries OUR issuer", () => {
      amphora.add(ours(TEST_EC_KEY_SIG, "kid-1", issuer));
      amphora.external.add(foreign(TEST_OKP_KEY_SIG, "kid-2", issuer));

      amphora.external.remove("kid-2", issuer);

      expect(amphora.vault).toHaveLength(1);
      expect(amphora.findByIdSync("kid-1", issuer).internal).toBe(true);
    });
  });

  describe("external facet — issuer sources", () => {
    const jwksUri = "https://peer.lindorm.io/.well-known/jwks.json";
    const externalIssuer = "https://peer.lindorm.io/";

    const publicJwk = () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    test("addIssuer fetches the source's keys before it resolves", async () => {
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({ issuer: externalIssuer, jwksUri });

      expect(nock.isDone()).toBe(true);
      expect(amphora.external.issuers()).toHaveLength(1);
      expect(amphora.external.issuers()[0]!.lastRefresh).toBeInstanceOf(Date);
      expect(amphora.external.issuers()[0]!.keyCount).toBe(1);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(1);
    });

    // `required` decides whether one bad entry in the SETUP sweep is fatal to
    // the boot. There is no sweep here — a single imperative call reports its own
    // failure to its own caller, so it throws whatever `required` says.
    test("addIssuer throws when the fetch fails, default (non-required) source", async () => {
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.external.addIssuer({ issuer: externalIssuer, jwksUri }),
      ).rejects.toThrow();

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    // Registration is the point of no return, so it comes AFTER the fetch. A
    // source amphora could not fetch is not a source amphora holds — leaving a
    // keyless entry registered would advertise an issuer it cannot verify.
    test("a failed addIssuer registers no source", async () => {
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.external.addIssuer({ issuer: externalIssuer, jwksUri }),
      ).rejects.toThrow();

      expect(amphora.external.issuers()).toHaveLength(0);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    // Registering spends the `maxIssuers` cap, and spending it evicts a peer.
    // A source that never loaded must not buy that eviction.
    test("a failed addIssuer does not evict a healthy peer under the maxIssuers cap", async () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxIssuers: 1,
      });

      nock("https://healthy.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await instance.external.addIssuer({
        issuer: "https://healthy.lindorm.io/",
        jwksUri: "https://healthy.lindorm.io/.well-known/jwks.json",
      });

      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        instance.external.addIssuer({ issuer: externalIssuer, jwksUri }),
      ).rejects.toThrow();

      expect(instance.external.issuers().map((c) => c.issuer)).toEqual([
        "https://healthy.lindorm.io/",
      ]);
      expect(
        instance.vault.filter((k) => k.issuer === "https://healthy.lindorm.io/"),
      ).toHaveLength(1);
      expect(nock.isDone()).toBe(true);
    });

    test("removeIssuer drops the source and evicts its keys", async () => {
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({ issuer: externalIssuer, jwksUri });
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(1);

      amphora.external.removeIssuer(externalIssuer);

      expect(amphora.external.issuers()).toHaveLength(0);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("refresh(issuer) is a no-op for an issuer with no source", async () => {
      await expect(
        amphora.external.refresh("https://unknown.lindorm.io/"),
      ).resolves.toBeUndefined();
    });

    test("enriches an issuer-only source: discovery then jwks", async () => {
      nock("https://enrich.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          issuer: "https://enrich.lindorm.io/",
          jwks_uri: "https://enrich.lindorm.io/.well-known/jwks.json",
        });

      nock("https://enrich.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({
        issuer: "https://enrich.lindorm.io/",
      });

      const [config] = amphora.external.issuers();
      expect(config!.issuer).toBe("https://enrich.lindorm.io/");
      expect(config!.jwksUri).toBe("https://enrich.lindorm.io/.well-known/jwks.json");
      expect(config!.openIdConfiguration).not.toBeNull();
      expect(config!.keyCount).toBe(1);
      expect(nock.isDone()).toBe(true);
    });
  });

  describe("maxIssuers cap (LRU eviction)", () => {
    const publicJwk = () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    // Registration FETCHES, so every issuer this suite registers must be
    // answerable — one host pattern serving the same key everywhere. The cap is
    // what is under test here, never the fetch.
    beforeEach(() => {
      nock(/lindorm\.io/)
        .persist()
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [publicJwk()] });
    });

    afterEach(() => {
      nock.cleanAll();
      MockDate.set(MockedDate);
    });

    test("default cap is 1000 — the 1001st external issuer evicts one", async () => {
      const instance = new Amphora({ internal: { issuer }, logger: createMockLogger() });

      for (let i = 0; i < 1001; i++) {
        await instance.external.addIssuer({
          issuer: `https://issuer-${i}.lindorm.io/`,
          jwksUri: `https://issuer-${i}.lindorm.io/.well-known/jwks.json`,
        });
      }

      expect(instance.external.issuers()).toHaveLength(1000);
      // Equal (frozen) lastAccess ⇒ the earliest-registered is evicted first.
      expect(
        instance.external
          .issuers()
          .some((c) => c.issuer === "https://issuer-0.lindorm.io/"),
      ).toBe(false);
      // 1001 sequential registrations, each a nock-served fetch: ~4.8s of work
      // against vitest's 5s default, so it timed out whenever another suite file
      // ran beside it. The cost is inherent to proving the DEFAULT cap, so the
      // budget is what was wrong.
    }, 20000);

    test("evicts the least-recently-USED external issuer on addIssuer overflow", async () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxIssuers: 2,
      });

      MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
      await instance.external.addIssuer({
        issuer: "https://a.lindorm.io/",
        jwksUri: "https://a.lindorm.io/.well-known/jwks.json",
      });

      MockDate.set(new Date("2024-01-01T08:00:01.000Z"));
      await instance.external.addIssuer({
        issuer: "https://b.lindorm.io/",
        jwksUri: "https://b.lindorm.io/.well-known/jwks.json",
      });

      // Use A — B is now the least-recently-used external issuer.
      MockDate.set(new Date("2024-01-01T08:00:02.000Z"));
      const key = await instance.find({ issuer: "https://a.lindorm.io/" });
      expect(key.issuer).toBe("https://a.lindorm.io/");

      // Registering C overflows the cap of 2 → B (LRU) is evicted, not A or C.
      MockDate.set(new Date("2024-01-01T08:00:03.000Z"));
      await instance.external.addIssuer({
        issuer: "https://c.lindorm.io/",
        jwksUri: "https://c.lindorm.io/.well-known/jwks.json",
      });

      const issuers = instance.external.issuers().map((c) => c.issuer);
      expect(issuers).toHaveLength(2);
      expect(issuers).toContain("https://a.lindorm.io/");
      expect(issuers).toContain("https://c.lindorm.io/");
      expect(issuers).not.toContain("https://b.lindorm.io/");

      // B's fetched keys are evicted from the vault; A's survive.
      expect(instance.vault.some((k) => k.issuer === "https://b.lindorm.io/")).toBe(
        false,
      );
      expect(instance.vault.some((k) => k.issuer === "https://a.lindorm.io/")).toBe(true);
    });

    test("the idp is exempt from the cap", async () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxIssuers: 1,
      });

      await instance.idp.set({
        issuer: "https://idp.lindorm.io/",
        jwksUri: "https://idp.lindorm.io/.well-known/jwks.json",
      });

      await instance.external.addIssuer({
        issuer: "https://a.lindorm.io/",
        jwksUri: "https://a.lindorm.io/.well-known/jwks.json",
      });
      await instance.external.addIssuer({
        issuer: "https://b.lindorm.io/",
        jwksUri: "https://b.lindorm.io/.well-known/jwks.json",
      });

      // External capped at 1 → only the most recent external survives...
      expect(instance.external.issuers().map((c) => c.issuer)).toEqual([
        "https://b.lindorm.io/",
      ]);
      // ...but the idp is untouched.
      expect(instance.idp.config().issuer).toBe("https://idp.lindorm.io/");
    });

    test("a never-used constructor external issuer is evicted before a freshly-registered one", async () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        maxIssuers: 1,
        external: [
          {
            issuer: "https://static.lindorm.io/",
            jwksUri: "https://static.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      // A constructor-seeded issuer starts never-used — `setup()` has not run,
      // so nothing has fetched or touched it.
      expect(instance.external.issuers()[0]!.lastAccess).toBeNull();

      await instance.external.addIssuer({
        issuer: "https://dynamic.lindorm.io/",
        jwksUri: "https://dynamic.lindorm.io/.well-known/jwks.json",
      });

      // null lastAccess sorts oldest → the static issuer is evicted first.
      expect(instance.external.issuers().map((c) => c.issuer)).toEqual([
        "https://dynamic.lindorm.io/",
      ]);
    });

    test("find bumps the external issuer's lastAccess", async () => {
      const instance = new Amphora({ internal: { issuer }, logger: createMockLogger() });

      await instance.external.addIssuer({
        issuer: "https://a.lindorm.io/",
        jwksUri: "https://a.lindorm.io/.well-known/jwks.json",
      });

      MockDate.set(new Date("2024-01-01T09:00:00.000Z"));
      await instance.find({ issuer: "https://a.lindorm.io/" });

      expect(instance.external.issuers()[0]!.lastAccess).toEqual(
        new Date("2024-01-01T09:00:00.000Z"),
      );
    });
  });

  describe("external issuer validation (item 1)", () => {
    // Validation is SYNCHRONOUS, at registration, before any network call — so
    // an invalid source is rejected outright rather than surfacing as a fetch
    // failure. The unconsumed jwksUri interceptor-less host proves nothing was
    // fetched: a request would have failed the nock guard instead.
    test("rejects a non-URI issuer with external_issuer_not_uri", async () => {
      const promise = amphora.external.addIssuer({
        issuer: "not-a-uri",
        jwksUri: "https://x.lindorm.io/.well-known/jwks.json",
      });

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "external_issuer_not_uri" }),
      );

      // The bad source was never registered.
      expect(amphora.external.issuers()).toHaveLength(0);
    });

    test("rejects a URN issuer without a jwksUri (cannot discover a URN)", async () => {
      const promise = amphora.external.addIssuer({
        issuer: "urn:lindorm:tyr:client:abc",
      });

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "non_http_issuer_requires_jwks_uri" }),
      );
    });

    // Not a URN, and it has an authority — so a URN-shaped rule accepted it and
    // discovery derived `ftp://example.com/.well-known/openid-configuration`.
    // Deriving a location needs a scheme amphora can request over.
    test("rejects a non-http URI issuer without a jwksUri", async () => {
      const promise = amphora.external.addIssuer({ issuer: "ftp://example.com" });

      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "non_http_issuer_requires_jwks_uri" }),
      );

      expect(amphora.external.issuers()).toHaveLength(0);
    });

    test("accepts a non-http URI issuer WITH a jwksUri — an identity, not an address", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      nock("https://ftp-keys.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      await amphora.external.addIssuer({
        issuer: "ftp://example.com",
        jwksUri: "https://ftp-keys.lindorm.io/.well-known/jwks.json",
      });

      expect(amphora.vault.filter((k) => k.issuer === "ftp://example.com")).toHaveLength(
        1,
      );
    });

    // The discovery uri is the first thing validated and it used to return
    // early, so junk here skipped every other check and surfaced as a failed
    // request — or, worse, was silently ignored once a valid issuer + jwksUri
    // sat beside it.
    test("rejects a non-http openIdConfigurationUri instead of skipping validation", async () => {
      const promise = amphora.external.addIssuer({
        openIdConfigurationUri: "foo:bar",
      });

      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          code: "external_openid_configuration_uri_not_http_url",
        }),
      );

      expect(amphora.external.issuers()).toHaveLength(0);
    });

    test("rejects a non-http jwksUri", async () => {
      const promise = amphora.external.addIssuer({
        issuer: "https://x.lindorm.io/",
        jwksUri: "foo:bar",
      });

      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "external_jwks_uri_not_http_url" }),
      );
    });

    test("accepts a URN issuer WITH a jwksUri (the tyr client-cache shape)", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      nock("https://urn-keys.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      await amphora.external.addIssuer({
        issuer: "urn:lindorm:tyr:client:abc",
        jwksUri: "https://urn-keys.lindorm.io/.well-known/jwks.json",
      });

      expect(
        amphora.vault.filter((k) => k.issuer === "urn:lindorm:tyr:client:abc"),
      ).toHaveLength(1);
    });

    test("idp.set rejects a non-URI issuer", async () => {
      const promise = amphora.idp.set({
        issuer: "not-a-uri",
        jwksUri: "https://x.lindorm.io/.well-known/jwks.json",
      });

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "external_issuer_not_uri" }),
      );
    });

    test("construction rejects a non-URI external issuer up front", () => {
      expect(
        () =>
          new Amphora({
            logger: createMockLogger(),
            external: [{ issuer: "not-a-uri", jwksUri: "https://x.lindorm.io/jwks" }],
          }),
      ).toThrow(AmphoraError);
    });
  });

  describe("resolved issuer required + scope exclusivity", () => {
    test("rejects a discovery doc that omits an issuer (external_issuer_unresolved)", async () => {
      nock("https://noissuer.lindorm.io")
        .get("/.well-known/openid-configuration")
        .reply(200, { jwksUri: "https://noissuer.lindorm.io/.well-known/jwks.json" });

      const promise = amphora.external.addIssuer({
        openIdConfigurationUri:
          "https://noissuer.lindorm.io/.well-known/openid-configuration",
      });

      await expect(promise).rejects.toThrow(AmphoraError);
      await expect(promise).rejects.toThrow(
        expect.objectContaining({ code: "external_issuer_unresolved" }),
      );
    });

    test("addIssuer rejects an issuer already claimed by the idp", async () => {
      nock("https://up.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, OPEN_ID_JWKS_RESPONSE);

      await amphora.idp.set({
        issuer: "https://up.lindorm.io/",
        jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
      });

      await expect(
        amphora.external.addIssuer({
          issuer: "https://up.lindorm.io/",
          jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "issuer_scope_conflict" }));
    });

    test("idp.set rejects an issuer already claimed by an external provider", async () => {
      nock("https://ext.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, OPEN_ID_JWKS_RESPONSE);

      await amphora.external.addIssuer({
        issuer: "https://ext.lindorm.io/",
        jwksUri: "https://ext.lindorm.io/.well-known/jwks.json",
      });

      await expect(
        amphora.idp.set({
          issuer: "https://ext.lindorm.io/",
          jwksUri: "https://ext.lindorm.io/.well-known/jwks.json",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "issuer_scope_conflict" }));
    });

    test("removeIssuer refuses the idp's issuer (use idp.clear)", async () => {
      nock("https://up.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, OPEN_ID_JWKS_RESPONSE);

      await amphora.idp.set({
        issuer: "https://up.lindorm.io/",
        jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
      });

      expect(() => amphora.external.removeIssuer("https://up.lindorm.io/")).toThrow(
        expect.objectContaining({ code: "remove_issuer_is_idp" }),
      );
    });
  });

  /**
   * `AmphoraExternalConfig.issuer` is a `string`, so the nullable, still-resolving
   * shape must not escape. A source registered by `openIdConfigurationUri` alone
   * carries no issuer until that document is fetched — a window that now opens
   * only for a CONSTRUCTOR-declared source: before `setup()`, or after it when a
   * non-`required` fetch failed. Each facet answers it differently because the
   * questions differ: `idp.config()` named ONE provider, `issuers()` asked what
   * amphora holds.
   */
  describe("unresolved issuer at the public boundary", () => {
    const discoveryUri = "https://pending.lindorm.io/.well-known/openid-configuration";

    test("idp.config() throws before setup() when the idp declares only a discovery uri", () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        idp: { openIdConfigurationUri: discoveryUri },
      });

      expect(() => instance.idp.config()).toThrow(AmphoraError);
      expect(() => instance.idp.config()).toThrow(
        expect.objectContaining({
          code: "idp_issuer_unresolved",
          data: { openIdConfigurationUri: discoveryUri },
        }),
      );
    });

    test("idp.config() returns the config once the issuer resolves", async () => {
      nock("https://pending.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          issuer: "https://pending.lindorm.io/",
          jwks_uri: "https://pending.lindorm.io/.well-known/jwks.json",
        });

      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      nock("https://pending.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      await amphora.idp.set({ openIdConfigurationUri: discoveryUri });

      expect(amphora.idp.config().issuer).toBe("https://pending.lindorm.io/");
    });

    // One pending peer must not take out the listing of every other issuer —
    // the same partial-failure tolerance `refreshAll` is built on.
    test("external.issuers() omits a not-yet-resolved source and keeps the rest", () => {
      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          { openIdConfigurationUri: discoveryUri },
          {
            issuer: "https://settled.lindorm.io/",
            jwksUri: "https://settled.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      expect(instance.external.issuers().map((c) => c.issuer)).toEqual([
        "https://settled.lindorm.io/",
      ]);
    });

    // Same shape AFTER setup: the discovery fetch failed and the source was not
    // `required`, so setup completed and the source is still issuer-less. The
    // healthy peer beside it is what proves the listing survived, not the sweep.
    test("external.issuers() still omits a source whose non-required setup fetch failed", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      nock("https://pending.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      nock("https://settled.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      const instance = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          { openIdConfigurationUri: discoveryUri },
          {
            issuer: "https://settled.lindorm.io/",
            jwksUri: "https://settled.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(instance.setup()).resolves.toBeUndefined();

      expect(instance.external.issuers().map((c) => c.issuer)).toEqual([
        "https://settled.lindorm.io/",
      ]);
      expect(nock.isDone()).toBe(true);
    });

    test("external.issuers() lists the source once its issuer resolves", async () => {
      nock("https://pending.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(200, {
          ...OPEN_ID_CONFIGURATION_RESPONSE,
          issuer: "https://pending.lindorm.io/",
          jwks_uri: "https://pending.lindorm.io/.well-known/jwks.json",
        });

      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;

      nock("https://pending.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      await amphora.external.addIssuer({
        openIdConfigurationUri: discoveryUri,
      });

      expect(amphora.external.issuers().map((c) => c.issuer)).toEqual([
        "https://pending.lindorm.io/",
      ]);
    });
  });

  describe("granular find-miss refresh", () => {
    const issuerA = "https://iss-a.lindorm.io/";
    const issuerB = "https://iss-b.lindorm.io/";
    const jwksA = "https://iss-a.lindorm.io/.well-known/jwks.json";
    const jwksB = "https://iss-b.lindorm.io/.well-known/jwks.json";

    test("find({id,issuer}) miss refetches ONLY that issuer, not all", async () => {
      const v1 = { ...TEST_EC_KEY_SIG.toJWK("public"), kid: "a-v1" };
      const v2 = { ...TEST_RSA_KEY_SIG.toJWK("public"), kid: "a-v2" };
      const b = { ...TEST_OKP_KEY_SIG.toJWK("public"), kid: "b-1" };
      delete v1.iss;
      delete v2.iss;
      delete b.iss;

      // setup fetches A(v1) and B once each.
      nock("https://iss-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [v1] });
      nock("https://iss-b.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [b] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          { issuer: issuerA, jwksUri: jwksA },
          { issuer: issuerB, jwksUri: jwksB },
        ],
      });

      await amphora.setup();

      // A rotates: a NEW kid appears on A only. B has NO further interceptor, so
      // a refresh-all would fail on B — proving the miss refetched A alone.
      nock("https://iss-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [v2] });

      const found = await amphora.find({ id: "a-v2", issuer: issuerA });

      expect(found.id).toBe("a-v2");
      expect(found.issuer).toBe(issuerA);
      expect(nock.isDone()).toBe(true);
    });
  });

  describe("findById cross-issuer id collision", () => {
    const issuerA = "https://iss-a.lindorm.io/";
    const issuerB = "https://iss-b.lindorm.io/";

    const seedCollision = async () => {
      const logger = createMockLogger();

      // Two issuers serve the SAME kid — kid uniqueness is PER ISSUER, so both
      // survive in the unified vault (eviction is by issuer, not by id).
      const a = { ...TEST_EC_KEY_SIG.toJWK("public"), kid: "shared-kid" };
      const b = { ...TEST_OKP_KEY_SIG.toJWK("public"), kid: "shared-kid" };
      delete a.iss;
      delete b.iss;

      nock("https://iss-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [a] });
      nock("https://iss-b.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [b] });

      amphora = new Amphora({
        internal: { issuer },
        logger,
        external: [
          {
            issuer: issuerA,
            jwksUri: "https://iss-a.lindorm.io/.well-known/jwks.json",
          },
          {
            issuer: issuerB,
            jwksUri: "https://iss-b.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();
    };

    test("unscoped findById THROWS on a collision, naming the colliding issuers", async () => {
      await seedCollision();

      await expect(amphora.findById("shared-kid")).rejects.toThrow(AmphoraError);
      await expect(amphora.findById("shared-kid")).rejects.toThrow(
        expect.objectContaining({
          code: "kryptos_ambiguous_id",
          data: expect.objectContaining({
            id: "shared-kid",
            issuer: null,
            count: 2,
            issuers: expect.arrayContaining([issuerA, issuerB]),
          }),
        }),
      );
    });

    test("unscoped findByIdSync throws the same ambiguity", async () => {
      await seedCollision();

      expect(() => amphora.findByIdSync("shared-kid")).toThrow(
        expect.objectContaining({ code: "kryptos_ambiguous_id" }),
      );
    });

    // The whole point: naming the issuer resolves the collision to exactly the
    // key that issuer published — never the peer's colliding one.
    test("a scoped findById resolves the collision to the named issuer's key", async () => {
      await seedCollision();

      const a = await amphora.findById("shared-kid", issuerA);
      const b = await amphora.findById("shared-kid", issuerB);

      expect(a.issuer).toBe(issuerA);
      expect(a.type).toBe("EC");
      expect(b.issuer).toBe(issuerB);
      expect(b.type).toBe("OKP");
    });

    test("a scoped findByIdSync resolves the collision to the named issuer's key", async () => {
      await seedCollision();

      expect(amphora.findByIdSync("shared-kid", issuerA).type).toBe("EC");
      expect(amphora.findByIdSync("shared-kid", issuerB).type).toBe("OKP");
    });

    // NO FALLBACK. An issuer that does not hold the id must fail, never retry
    // unscoped — a fallback would let a kid the claimed issuer lacks be answered
    // by whichever other issuer happens to hold one.
    test("a scoped miss does NOT fall back to an unscoped search", async () => {
      await seedCollision();

      const unknownIssuer = "https://iss-c.lindorm.io/";

      expect(() => amphora.findByIdSync("shared-kid", unknownIssuer)).toThrow(
        expect.objectContaining({
          code: "kryptos_not_found_by_id_sync",
          data: expect.objectContaining({ id: "shared-kid", issuer: unknownIssuer }),
        }),
      );

      await expect(amphora.findById("shared-kid", unknownIssuer)).rejects.toThrow(
        expect.objectContaining({
          code: "kryptos_not_found_by_id",
          data: expect.objectContaining({ id: "shared-kid", issuer: unknownIssuer }),
        }),
      );
    });

    // A scoped miss refetches THAT issuer alone. Both mocks below are `times(1)`
    // and already consumed by setup, so a refresh-all would 404 on the peer —
    // only the named issuer is allowed a second fetch.
    test("a scoped miss refetches only the named issuer", async () => {
      await seedCollision();

      const rotated = { ...TEST_RSA_KEY_SIG.toJWK("public"), kid: "rotated-kid" };
      delete rotated.iss;

      nock("https://iss-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [rotated] });

      const found = await amphora.findById("rotated-kid", issuerA);

      expect(found.id).toBe("rotated-kid");
      expect(found.issuer).toBe(issuerA);
      expect(nock.isDone()).toBe(true);
    });

    // The reason findById is unfiltered, restated against the scoped path: a
    // token signed by a since-expired key must still resolve. Time is the
    // caller's floor to enforce, not selection's.
    test("a scoped lookup still returns an EXPIRED key", async () => {
      const expiring = KryptosKit.clone(TEST_EC_KEY_SIG, {
        issuer,
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      });
      amphora.add(expiring);

      MockDate.set(new Date("2024-01-01T10:00:00.000Z"));

      expect(expiring.isExpired).toBe(true);
      expect(amphora.findByIdSync(expiring.id, issuer)).toEqual(expiring);
      await expect(amphora.findById(expiring.id, issuer)).resolves.toEqual(expiring);

      MockDate.set(MockedDate);
    });
  });

  describe("idp facet", () => {
    const idpIssuer = "https://idp.lindorm.io/";
    const idpJwksUri = "https://idp.lindorm.io/.well-known/jwks.json";

    const publicJwk = () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    test("idp.config() throws idp_not_configured when unset", () => {
      expect(() => amphora.idp.config()).toThrow(AmphoraError);
      expect(() => amphora.idp.config()).toThrow(
        expect.objectContaining({ code: "idp_not_configured" }),
      );
    });

    test("idp.set registers the upstream and loads its keys", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });

      expect(amphora.idp.config().issuer).toBe(idpIssuer);
      expect(amphora.idp.config().keyCount).toBe(1);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
    });

    test("idp.set replaces the singleton and evicts the previous idp's keys", async () => {
      nock("https://idp-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({
        issuer: "https://idp-a.lindorm.io/",
        jwksUri: "https://idp-a.lindorm.io/.well-known/jwks.json",
      });
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-a.lindorm.io/"),
      ).toHaveLength(1);

      const jwkB = TEST_OKP_KEY_SIG.toJWK("public");
      delete jwkB.iss;
      nock("https://idp-b.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwkB] });

      await amphora.idp.set({
        issuer: "https://idp-b.lindorm.io/",
        jwksUri: "https://idp-b.lindorm.io/.well-known/jwks.json",
      });

      expect(amphora.idp.config().issuer).toBe("https://idp-b.lindorm.io/");
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-a.lindorm.io/"),
      ).toHaveLength(0);
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-b.lindorm.io/"),
      ).toHaveLength(1);
    });

    // A swap trades a working upstream for a new one, and the trade is
    // all-or-nothing: the new source is resolved and fetched into an entry the
    // vault is not serving from, so a failure throws with the previous idp
    // exactly as it was rather than leaving the service with neither.
    test("a failed set leaves the previous idp serving — same config, same keys", async () => {
      nock("https://idp-a.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({
        issuer: "https://idp-a.lindorm.io/",
        jwksUri: "https://idp-a.lindorm.io/.well-known/jwks.json",
      });

      const before = amphora.idp.config();

      nock("https://idp-b.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.idp.set({
          issuer: "https://idp-b.lindorm.io/",
          jwksUri: "https://idp-b.lindorm.io/.well-known/jwks.json",
        }),
      ).rejects.toThrow();

      expect(amphora.idp.config()).toEqual(before);
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-a.lindorm.io/"),
      ).toHaveLength(1);
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-b.lindorm.io/"),
      ).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    test("a failed set with no previous idp leaves no half-installed entry", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri }),
      ).rejects.toThrow();

      expect(() => amphora.idp.config()).toThrow(
        expect.objectContaining({ code: "idp_not_configured" }),
      );
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    // Replacing an idp with the SAME issuer is the case where eviction and
    // installation collide: eviction is BY issuer, so it has to happen before
    // the fetched keys land — applying first and evicting after would drop the
    // very keys just installed.
    test("re-setting the SAME issuer installs the freshly fetched keys", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);

      // The upstream rotates: same issuer, a different key.
      const rotated = TEST_OKP_KEY_SIG.toJWK("public");
      delete rotated.iss;

      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [rotated] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });

      const keys = amphora.vault.filter((k) => k.issuer === idpIssuer);
      expect(keys).toHaveLength(1);
      expect(keys[0]!.id).toBe(rotated.kid);
      expect(amphora.idp.config().keyCount).toBe(1);
      expect(nock.isDone()).toBe(true);
    });

    test("a failed set of the SAME issuer keeps the serving keys", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });

      const before = amphora.idp.config();

      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri }),
      ).rejects.toThrow();

      expect(amphora.idp.config()).toEqual(before);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
      expect(nock.isDone()).toBe(true);
    });

    test("idp.clear evicts the idp keys and unsets config", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });

      amphora.idp.clear();

      expect(() => amphora.idp.config()).toThrow(AmphoraError);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(0);
    });

    test("idp.refresh refetches the upstream", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri });
      await amphora.idp.refresh();

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
    });

    test("construction seeds the idp; setup loads it", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        idp: { issuer: idpIssuer, jwksUri: idpJwksUri },
      });

      // Seeded (unresolved) before setup — config() does not throw.
      expect(() => amphora.idp.config()).not.toThrow();
      expect(amphora.idp.config().lastRefresh).toBeNull();

      await amphora.setup();

      expect(amphora.idp.config().keyCount).toBe(1);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
    });

    test("top-level refresh() refetches the idp AND all external", async () => {
      const extJwk = TEST_OKP_KEY_SIG.toJWK("public");
      delete extJwk.iss;

      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [publicJwk()] });
      nock("https://ext.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [extJwk] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        idp: { issuer: idpIssuer, jwksUri: idpJwksUri },
        external: [
          {
            issuer: "https://ext.lindorm.io/",
            jwksUri: "https://ext.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await amphora.setup();
      await amphora.refresh();

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
      expect(
        amphora.vault.filter((k) => k.issuer === "https://ext.lindorm.io/"),
      ).toHaveLength(1);
    });
  });

  /**
   * `required` is the whole of the strictness story: it does not say WHEN an
   * issuer is fetched — every registered issuer is fetched at `setup()` — only
   * whether a failure there is fatal.
   *
   * The asymmetry between boot and steady state is deliberate. STRICT at
   * `setup()`: a service whose required upstream cannot be resolved cannot
   * verify a single token from it, so it must not come up pretending otherwise.
   * LENIENT at every periodic refresh afterwards: the process is already
   * serving on keys that resolved, and a transient blip at the provider must not
   * kill it — the refresh interval is the retry backoff.
   */
  describe("required at setup, lenient at refresh", () => {
    const idpIssuer = "https://idp.lindorm.io/";
    const idpJwksUri = "https://idp.lindorm.io/.well-known/jwks.json";
    const peerIssuer = "https://peer.lindorm.io/";
    const peerJwksUri = "https://peer.lindorm.io/.well-known/jwks.json";
    const healthyIssuer = "https://healthy.lindorm.io/";
    const healthyJwksUri = "https://healthy.lindorm.io/.well-known/jwks.json";

    const publicJwk = (key = TEST_EC_KEY_SIG) => {
      const jwk = key.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    const healthy = () =>
      nock("https://healthy.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk(TEST_OKP_KEY_SIG)] });

    // Several cases deliberately leave a failing interceptor unconsumed; a leaked
    // one would answer a later test's request (or, once spent, let it reach the
    // real network).
    afterEach(() => {
      nock.cleanAll();
    });

    // A HEALTHY peer stands beside the broken one on purpose. Without it the
    // test would also pass under the "every provider failed" throw this
    // replaced, so it would not be testing `required` at all.
    test("setup() throws when a REQUIRED external fails, with a healthy peer alongside", async () => {
      healthy();

      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [
          { issuer: healthyIssuer, jwksUri: healthyJwksUri },
          { required: true, issuer: peerIssuer, jwksUri: peerJwksUri },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow();

      // The sweep itself stayed tolerant — only the verdict at its end is strict.
      expect(amphora.vault.filter((k) => k.issuer === healthyIssuer)).toHaveLength(1);
      expect(amphora.vault.filter((k) => k.issuer === peerIssuer)).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    // ALONE, with nothing healthy to hide behind: the default is not required,
    // so the failure is a warn and boot proceeds.
    test("setup() completes when the ONLY external fails and is not required", async () => {
      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      amphora = new Amphora({
        internal: { issuer },
        logger,
        external: [{ issuer: peerIssuer, jwksUri: peerJwksUri }],
      });

      await expect(amphora.setup()).resolves.toBeUndefined();

      expect(child.warn).toHaveBeenCalledWith(
        "Failed to refresh external JWKS",
        expect.objectContaining({ issuer: peerIssuer }),
      );
      expect(amphora.external.issuers()[0]!.lastRefresh).toBeNull();
      expect(amphora.vault.filter((k) => k.issuer === peerIssuer)).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    // The idp takes no `required` flag because it is always required — same
    // verdict, reached without anything to declare.
    test("setup() throws when the IDP fails, with a healthy external alongside", async () => {
      healthy();

      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        idp: { issuer: idpIssuer, jwksUri: idpJwksUri },
        external: [{ issuer: healthyIssuer, jwksUri: healthyJwksUri }],
      });

      await expect(amphora.setup()).rejects.toThrow();

      expect(amphora.vault.filter((k) => k.issuer === healthyIssuer)).toHaveLength(1);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(0);
      expect(nock.isDone()).toBe(true);
    });

    // `set` is the runtime twin of the boot path and must not be laxer: both
    // reach the upstream through the same load, and both throw when it fails.
    test("idp.set() throws when the upstream cannot be loaded", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(
        amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri }),
      ).rejects.toThrow();

      expect(nock.isDone()).toBe(true);
    });

    // Both a required external AND the idp resolve at boot, then both fail the
    // NEXT sweep. Neither throws — this is the half of the rule that keeps a
    // serving process alive through a provider blip.
    test("a required external and the idp both survive a later refresh failure", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk(TEST_OKP_KEY_SIG)] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        idp: { issuer: idpIssuer, jwksUri: idpJwksUri },
        external: [{ required: true, issuer: peerIssuer, jwksUri: peerJwksUri }],
      });

      await amphora.setup();

      // Both upstreams go down AFTER a successful boot.
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(503, { error: "Service Unavailable" });

      await expect(amphora.refresh()).resolves.toBeUndefined();

      // The previously fetched configs and keys are still serving.
      expect(amphora.idp.config().issuer).toBe(idpIssuer);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(1);
      expect(amphora.vault.filter((k) => k.issuer === peerIssuer)).toHaveLength(1);
      expect(nock.isDone()).toBe(true);
    });

    // A bare `kid` does not say which issuer owns it, so nothing in the lookup
    // can name the source the key lives on. That is precisely the narrowing this
    // shape removes: an external nobody had ever asked about BY NAME used to be
    // unreachable this way, and the lookup answered "no such key" while amphora
    // held the registration all along.
    test("findById resolves a bare kid from an external nobody named", async () => {
      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [] });

      amphora = new Amphora({
        internal: { issuer },
        logger: createMockLogger(),
        external: [{ issuer: peerIssuer, jwksUri: peerJwksUri }],
      });

      await amphora.setup();

      expect(amphora.vault.filter((k) => k.issuer === peerIssuer)).toHaveLength(0);

      // The peer rotates a key in AFTER boot. Nothing below names its issuer.
      const rotated = { ...publicJwk(), kid: "rotated-kid" };

      nock("https://peer.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [rotated] });

      const found = await amphora.findById("rotated-kid");

      expect(found.id).toBe("rotated-kid");
      expect(found.issuer).toBe(peerIssuer);
      expect(nock.isDone()).toBe(true);
    });
  });
});

describe("Amphora environment enforcement", () => {
  const issuer = "https://test.lindorm.io/";

  const keyForEnvironment = (environment: "development" | "production") =>
    KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      certificate: { mode: "self-signed", subject: "leaf", environment },
    });

  test("rejects a key whose certificate environment differs", () => {
    const amphora = new Amphora({
      internal: { issuer },
      environment: "development",
      logger: createMockLogger(),
    });

    expect(() => amphora.add(keyForEnvironment("production"))).toThrow(AmphoraError);

    try {
      amphora.add(keyForEnvironment("production"));
    } catch (error) {
      expect((error as AmphoraError).code).toBe("environment_mismatch");
      expect((error as AmphoraError).data).toMatchObject({
        expected: "development",
        actual: "production",
      });
    }
  });

  test("accepts a key whose certificate environment matches", () => {
    const amphora = new Amphora({
      internal: { issuer },
      environment: "development",
      logger: createMockLogger(),
    });

    expect(() => amphora.add(keyForEnvironment("development"))).not.toThrow();
    expect(amphora.vault).toHaveLength(1);
  });

  test("accepts a key without a certificate (e.g. an oct KEK)", () => {
    const amphora = new Amphora({
      internal: { issuer },
      environment: "development",
      logger: createMockLogger(),
    });
    const kek = KryptosKit.generate.enc.oct({ algorithm: "A256KW", issuer });

    expect(() => amphora.add(kek)).not.toThrow();
    expect(amphora.vault.map((k) => k.id)).toContain(kek.id);
  });

  test("accepts a key whose certificate OU is a foreign (non-environment) value", () => {
    const amphora = new Amphora({
      internal: { issuer },
      environment: "development",
      logger: createMockLogger(),
    });
    const foreign = createMockKryptos({
      id: "foreign-dept-key",
      issuer,
      jwksUri: new URL("/.well-known/jwks.json", issuer).toString(),
      hasCertificate: true,
      certificate: {
        subject: { organizationalUnit: "platform-engineering" },
      } as never,
    });

    expect(() => amphora.add(foreign)).not.toThrow();
    expect(amphora.vault.map((k) => k.id)).toContain("foreign-dept-key");
  });

  test("an amphora without an environment ignores certificate environments", () => {
    const amphora = new Amphora({ internal: { issuer }, logger: createMockLogger() });

    expect(() => amphora.add(keyForEnvironment("production"))).not.toThrow();
    expect(amphora.vault).toHaveLength(1);
  });
});

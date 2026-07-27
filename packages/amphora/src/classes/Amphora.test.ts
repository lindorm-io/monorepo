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
    amphora = new Amphora({ domain: issuer, logger: createMockLogger() });
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

    test("should warn when an env-imported key issuer differs from the domain", () => {
      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);
      const scoped = new Amphora({ domain: issuer, logger });

      const foreign = KryptosKit.from.jwk(
        { ...TEST_EC_KEY_SIG.toJWK("private"), iss: "https://other.lindorm.io/" },
        false,
      );
      scoped.env(KryptosKit.env.export(foreign));

      expect(child.warn).toHaveBeenCalledWith(
        "Env-imported key issuer differs from amphora domain",
        expect.objectContaining({ issuer: "https://other.lindorm.io/" }),
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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

    test("should report no signing capability for a vault holding only internal keys", () => {
      amphora.add(internalSig);

      expect(amphora.canSign()).toBe(false);
      expect(amphora.canVerify()).toBe(false);
    });

    test("should exclude internal keys from the jwks", () => {
      const internalEc = KryptosKit.clone(TEST_EC_KEY_SIG, { publish: false });

      amphora.add([internalEc, TEST_OKP_KEY_SIG]);

      expect(internalEc.hasPublicKey).toBe(true);
      expect(amphora.jwks.keys.some((k) => k.kid === internalEc.id)).toBe(false);
      expect(amphora.jwks.keys.some((k) => k.kid === TEST_OKP_KEY_SIG.id)).toBe(true);
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
        domain: issuer,
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

      // Before setup the issuer sources are seeded but unresolved.
      expect(
        amphora.external.issuers().map((c) => ({
          keyCount: c.keyCount,
          lastRefresh: c.lastRefresh,
        })),
      ).toEqual([
        { keyCount: 0, lastRefresh: null },
        { keyCount: 0, lastRefresh: null },
        { keyCount: 0, lastRefresh: null },
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
        domain: issuer,
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

  describe("domain validation", () => {
    test("should throw AmphoraError when domain is not a valid URL", () => {
      expect(
        () =>
          new Amphora({
            domain: "not-a-url",
            logger: createMockLogger(),
          }),
      ).toThrow(AmphoraError);
    });

    test("should throw AmphoraError with debug context when domain is invalid", () => {
      expect(
        () =>
          new Amphora({
            domain: "not-a-url",
            logger: createMockLogger(),
          }),
      ).toThrow("Domain must be a valid URL");
    });
  });

  describe("error context for find()", () => {
    test("should include debug context in error when key not found", async () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      try {
        await amphora.find({ issuer, id: "non-existent-id" });
        fail("Expected find() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).message).toBe(
          "Kryptos not found using query after refresh",
        );
        expect((error as AmphoraError).code).toBe(
          "kryptos_not_found_by_query_after_refresh",
        );
        expect((error as AmphoraError).data).toEqual({
          queryKeys: ["issuer", "id"],
          totalKeys: 2,
          activeKeys: 2,
        });
      }
    });
  });

  describe("error context for findSync()", () => {
    test("should include debug context in error when key not found", () => {
      amphora.add([TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG]);

      try {
        amphora.findSync({ issuer, id: "non-existent-id" });
        fail("Expected findSync() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).message).toBe(
          "Kryptos not found using query (sync, no refresh)",
        );
        expect((error as AmphoraError).code).toBe("kryptos_not_found_by_query_sync");
        expect((error as AmphoraError).data).toEqual({
          queryKeys: ["issuer", "id"],
          totalKeys: 2,
          activeKeys: 2,
        });
      }
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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

    test("should throw when all providers fail", async () => {
      nock("https://external.lindorm.io")
        .get("/.well-known/openid-configuration")
        .times(1)
        .reply(500, { error: "Internal Server Error" });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);
      await expect(amphora.setup()).rejects.toThrow(
        "All external config providers failed during refresh",
      );
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
        domain: issuer,
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

    test("should reject keys with mismatched issuer", async () => {
      const jwkWithWrongIssuer = TEST_EC_KEY_SIG.toJWK("private");
      jwkWithWrongIssuer.iss = "https://attacker.com/";

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwkWithWrongIssuer] });

      amphora = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: "https://external.lindorm.io/",
            jwksUri: "https://external.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);
      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
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
        domain: issuer,
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
        domain: issuer,
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
    // issuer is OUR OWN domain: every other refreshJwks filter then passes — the
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
        domain: issuer,
        logger: createMockLogger(),
        external: [{ issuer, jwksUri: "https://test.lindorm.io/.well-known/jwks.json" }],
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

    // Captures the AmphoraError thrown per-issuer inside getExternalJwks, which
    // refreshExternalKeys swallows into a warn before throwing its own error.
    const providerError = (child: ReturnType<typeof createMockLogger>): AmphoraError => {
      const call = vi
        .mocked(child.warn)
        .mock.calls.find(([message]) => message === "Failed to refresh external JWKS");

      return (call?.[1] as { error: AmphoraError }).error;
    };

    const createScoped = (logger: ReturnType<typeof createMockLogger>) =>
      new Amphora({
        domain: issuer,
        logger,
        external: [{ issuer: externalIssuer, jwksUri: externalJwksUri }],
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

      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      amphora = createScoped(logger);

      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
      );

      const error = providerError(child);

      expect(error).toBeInstanceOf(AmphoraError);
      expect(error.code).toBe("external_jwks_all_unusable");
      expect(error.data).toEqual({
        issuer: externalIssuer,
        total: 2,
        rejected: 0,
        expired: 0,
        rejectedByTrust: 0,
        unusable: 2,
      });
    });

    test("should throw when the only keys are unparseable and expired, never return an empty set", async () => {
      const expired = { ...validJwk("key-expired"), exp: 1000000000 };

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [unparseableJwk("key-no-alg"), expired] });

      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      amphora = createScoped(logger);

      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
      );

      const error = providerError(child);

      expect(error.code).toBe("external_jwks_no_valid_keys");
      expect(error.data).toEqual({
        issuer: externalIssuer,
        total: 2,
        rejected: 0,
        expired: 1,
        rejectedByTrust: 0,
        unusable: 1,
      });
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should report per-cause counts when unparseable and issuer-mismatched keys mix", async () => {
      const mismatched = { ...validJwk("key-mismatch"), iss: "https://attacker.com/" };

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [unparseableJwk("key-no-alg"), mismatched] });

      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      amphora = createScoped(logger);

      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
      );

      const error = providerError(child);

      expect(error.code).toBe("external_jwks_no_valid_keys");
      expect(error.data).toEqual({
        issuer: externalIssuer,
        total: 2,
        rejected: 1,
        expired: 0,
        rejectedByTrust: 0,
        unusable: 1,
      });
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

    test("should not allow mutation of config via getter", () => {
      // config is the service's own identity, derived from the domain.
      expect(amphora.config).toEqual([
        {
          issuer,
          jwksUri: new URL("/.well-known/jwks.json", issuer).toString(),
        },
      ]);

      const config = amphora.config;
      config.length = 0;

      expect(amphora.config).toHaveLength(1);
    });

    test("should not allow mutation of external issuers via getter", async () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("private");
      delete jwk.iss;

      nock("https://external.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [jwk] });

      amphora = new Amphora({
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
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
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: ca.certificateChain[0],
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(AmphoraError);

      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);
    });

    test("should include rejectedByTrust in debug when all keys fail trust validation", async () => {
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
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
          },
        ],
      });

      try {
        await amphora.setup();
        fail("Expected setup() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).message).toBe(
          "All external JWKS providers failed during refresh",
        );
      }
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
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
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
            issuer: externalIssuer,
            jwksUri: externalJwksUri,
            trustAnchors: trustedCa.certificateChain[0],
            trustMode: "lax",
          },
        ],
      });

      await expect(amphora.setup()).rejects.toThrow(
        "All external JWKS providers failed during refresh",
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
        domain: issuer,
        logger: createMockLogger(),
        external: [
          {
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
        domain: issuer,
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
    test("external.add forces internal:false and does not stamp the amphora domain", () => {
      const key = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://foreign.lindorm.io/",
      });
      expect(key.internal).toBe(true);

      amphora.external.add(key);

      const stored = amphora.findByIdSync(key.id);
      expect(stored.internal).toBe(false);
      // Foreign issuer preserved — never overwritten with the amphora domain.
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

    test("external.remove drops a key by id", () => {
      const key = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
        issuer: "https://foreign.lindorm.io/",
      });
      amphora.external.add(key);
      expect(amphora.vault.find((k) => k.id === key.id)).toBeDefined();

      amphora.external.remove(key.id);
      expect(amphora.vault.find((k) => k.id === key.id)).toBeUndefined();
    });
  });

  describe("external facet — issuer sources", () => {
    const jwksUri = "https://lazy.lindorm.io/.well-known/jwks.json";
    const externalIssuer = "https://lazy.lindorm.io/";

    const publicJwk = () => {
      const jwk = TEST_EC_KEY_SIG.toJWK("public");
      delete jwk.iss;
      return jwk;
    };

    test("addIssuer registers lazily; refresh(issuer) loads it", async () => {
      nock("https://lazy.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({ issuer: externalIssuer, jwksUri });

      // Registered, not yet fetched.
      expect(amphora.external.issuers()).toHaveLength(1);
      expect(amphora.external.issuers()[0]!.lastRefresh).toBeNull();
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(0);

      await amphora.external.refresh(externalIssuer);

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(1);
      expect(amphora.external.issuers()[0]!.lastRefresh).toBeInstanceOf(Date);
      expect(amphora.external.issuers()[0]!.keyCount).toBe(1);
    });

    test("addIssuer with load:true eager-fetches immediately", async () => {
      nock("https://lazy.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({ issuer: externalIssuer, jwksUri, load: true });

      expect(nock.isDone()).toBe(true);
      expect(amphora.vault.filter((k) => k.issuer === externalIssuer)).toHaveLength(1);
    });

    test("removeIssuer drops the source and evicts its keys", async () => {
      nock("https://lazy.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.external.addIssuer({ issuer: externalIssuer, jwksUri, load: true });
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
        load: true,
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

    const persistJwks = (host: string) =>
      nock(`https://${host}.lindorm.io`)
        .persist()
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [publicJwk()] });

    afterEach(() => {
      nock.cleanAll();
      MockDate.set(MockedDate);
    });

    test("default cap is 1000 — the 1001st external issuer evicts one (lazy)", async () => {
      const instance = new Amphora({ domain: issuer, logger: createMockLogger() });

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
    });

    test("evicts the least-recently-USED external issuer on addIssuer overflow", async () => {
      const instance = new Amphora({
        domain: issuer,
        logger: createMockLogger(),
        maxIssuers: 2,
      });

      persistJwks("a");
      persistJwks("b");
      persistJwks("c");

      MockDate.set(new Date("2024-01-01T08:00:00.000Z"));
      await instance.external.addIssuer({
        issuer: "https://a.lindorm.io/",
        jwksUri: "https://a.lindorm.io/.well-known/jwks.json",
        load: true,
      });

      MockDate.set(new Date("2024-01-01T08:00:01.000Z"));
      await instance.external.addIssuer({
        issuer: "https://b.lindorm.io/",
        jwksUri: "https://b.lindorm.io/.well-known/jwks.json",
        load: true,
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
        load: true,
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
        domain: issuer,
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
        domain: issuer,
        logger: createMockLogger(),
        maxIssuers: 1,
        external: [
          {
            issuer: "https://static.lindorm.io/",
            jwksUri: "https://static.lindorm.io/.well-known/jwks.json",
          },
        ],
      });

      // Constructor-seeded issuer starts never-used.
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
      const instance = new Amphora({ domain: issuer, logger: createMockLogger() });

      persistJwks("a");

      await instance.external.addIssuer({
        issuer: "https://a.lindorm.io/",
        jwksUri: "https://a.lindorm.io/.well-known/jwks.json",
        load: true,
      });

      MockDate.set(new Date("2024-01-01T09:00:00.000Z"));
      await instance.find({ issuer: "https://a.lindorm.io/" });

      expect(instance.external.issuers()[0]!.lastAccess).toEqual(
        new Date("2024-01-01T09:00:00.000Z"),
      );
    });
  });

  describe("external issuer validation (item 1)", () => {
    test("rejects a non-URI issuer with external_issuer_not_uri", async () => {
      try {
        await amphora.external.addIssuer({
          issuer: "not-a-uri",
          jwksUri: "https://x.lindorm.io/.well-known/jwks.json",
          load: true,
        });
        fail("Expected addIssuer to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("external_issuer_not_uri");
      }
    });

    test("rejects a URN issuer without a jwksUri (cannot discover a URN)", async () => {
      try {
        await amphora.external.addIssuer({
          issuer: "urn:lindorm:tyr:client:abc",
          load: true,
        });
        fail("Expected addIssuer to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("urn_issuer_requires_jwks_uri");
      }
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
        load: true,
      });

      expect(
        amphora.vault.filter((k) => k.issuer === "urn:lindorm:tyr:client:abc"),
      ).toHaveLength(1);
    });

    test("rejects a non-URI issuer on the LAZY path (no load) at registration", async () => {
      // The default lazy path must validate at addIssuer time, NOT silently accept
      // and only warn on a later refresh.
      try {
        await amphora.external.addIssuer({
          issuer: "not-a-uri",
          jwksUri: "https://x.lindorm.io/.well-known/jwks.json",
        });
        fail("Expected addIssuer to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("external_issuer_not_uri");
      }
      // The bad source was never registered.
      expect(amphora.external.issuers()).toHaveLength(0);
    });

    test("idp.set rejects a non-URI issuer even when lazy", async () => {
      try {
        await amphora.idp.set({
          issuer: "not-a-uri",
          jwksUri: "https://x.lindorm.io/.well-known/jwks.json",
        });
        fail("Expected idp.set to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("external_issuer_not_uri");
      }
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

      try {
        await amphora.external.addIssuer({
          openIdConfigurationUri:
            "https://noissuer.lindorm.io/.well-known/openid-configuration",
          load: true,
        });
        fail("Expected addIssuer to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("external_issuer_unresolved");
      }
    });

    test("addIssuer rejects an issuer already claimed by the idp", async () => {
      await amphora.idp.set({
        issuer: "https://up.lindorm.io/",
        jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
      });

      try {
        await amphora.external.addIssuer({
          issuer: "https://up.lindorm.io/",
          jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
        });
        fail("Expected addIssuer to throw");
      } catch (error) {
        expect((error as AmphoraError).code).toBe("issuer_scope_conflict");
      }
    });

    test("idp.set rejects an issuer already claimed by an external provider", async () => {
      await amphora.external.addIssuer({
        issuer: "https://ext.lindorm.io/",
        jwksUri: "https://ext.lindorm.io/.well-known/jwks.json",
      });

      try {
        await amphora.idp.set({
          issuer: "https://ext.lindorm.io/",
          jwksUri: "https://ext.lindorm.io/.well-known/jwks.json",
        });
        fail("Expected idp.set to throw");
      } catch (error) {
        expect((error as AmphoraError).code).toBe("issuer_scope_conflict");
      }
    });

    test("removeIssuer refuses the idp's issuer (use idp.clear)", async () => {
      await amphora.idp.set({
        issuer: "https://up.lindorm.io/",
        jwksUri: "https://up.lindorm.io/.well-known/jwks.json",
      });

      try {
        amphora.external.removeIssuer("https://up.lindorm.io/");
        fail("Expected removeIssuer to throw");
      } catch (error) {
        expect((error as AmphoraError).code).toBe("remove_issuer_is_idp");
      }
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
        domain: issuer,
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

    const seedCollision = async (logger = createMockLogger()) => {
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
        domain: issuer,
        logger,
        external: [
          { issuer: issuerA, jwksUri: "https://iss-a.lindorm.io/.well-known/jwks.json" },
          { issuer: issuerB, jwksUri: "https://iss-b.lindorm.io/.well-known/jwks.json" },
        ],
      });

      await amphora.setup();
    };

    // OKP fixture is newer than the EC fixture (iat), so the iss-b key is the
    // most-recent of the collision.
    test("findById returns the most recent and warns, never throws or picks arbitrarily", async () => {
      const logger = createMockLogger();
      const child = createMockLogger();
      vi.mocked(logger.child).mockReturnValue(child);

      await seedCollision(logger);

      const found = await amphora.findById("shared-kid");
      expect(found.issuer).toBe(issuerB);

      expect(child.warn).toHaveBeenCalledWith(
        "Ambiguous findById: multiple keys share this id across issuers; returning most recent",
        expect.objectContaining({
          id: "shared-kid",
          count: 2,
          issuers: expect.arrayContaining([issuerA, issuerB]),
        }),
      );
    });

    test("findByIdSync applies the same most-recent rule", async () => {
      await seedCollision();

      expect(amphora.findByIdSync("shared-kid").issuer).toBe(issuerB);
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
      try {
        amphora.idp.config();
        fail("Expected idp.config() to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AmphoraError);
        expect((error as AmphoraError).code).toBe("idp_not_configured");
      }
    });

    test("idp.set registers the upstream and loads its keys", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri, load: true });

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
        load: true,
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
        load: true,
      });

      expect(amphora.idp.config().issuer).toBe("https://idp-b.lindorm.io/");
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-a.lindorm.io/"),
      ).toHaveLength(0);
      expect(
        amphora.vault.filter((k) => k.issuer === "https://idp-b.lindorm.io/"),
      ).toHaveLength(1);
    });

    test("idp.clear evicts the idp keys and unsets config", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(1)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri, load: true });

      amphora.idp.clear();

      expect(() => amphora.idp.config()).toThrow(AmphoraError);
      expect(amphora.vault.filter((k) => k.issuer === idpIssuer)).toHaveLength(0);
    });

    test("idp.refresh refetches the upstream", async () => {
      nock("https://idp.lindorm.io")
        .get("/.well-known/jwks.json")
        .times(2)
        .reply(200, { keys: [publicJwk()] });

      await amphora.idp.set({ issuer: idpIssuer, jwksUri: idpJwksUri, load: true });
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
        domain: issuer,
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
        domain: issuer,
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
      domain: issuer,
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
      domain: issuer,
      environment: "development",
      logger: createMockLogger(),
    });

    expect(() => amphora.add(keyForEnvironment("development"))).not.toThrow();
    expect(amphora.vault).toHaveLength(1);
  });

  test("accepts a key without a certificate (e.g. an oct KEK)", () => {
    const amphora = new Amphora({
      domain: issuer,
      environment: "development",
      logger: createMockLogger(),
    });
    const kek = KryptosKit.generate.enc.oct({ algorithm: "A256KW", issuer });

    expect(() => amphora.add(kek)).not.toThrow();
    expect(amphora.vault.map((k) => k.id)).toContain(kek.id);
  });

  test("accepts a key whose certificate OU is a foreign (non-environment) value", () => {
    const amphora = new Amphora({
      domain: issuer,
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
    const amphora = new Amphora({ domain: issuer, logger: createMockLogger() });

    expect(() => amphora.add(keyForEnvironment("production"))).not.toThrow();
    expect(amphora.vault).toHaveLength(1);
  });
});

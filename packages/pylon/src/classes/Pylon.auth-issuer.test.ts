// The issuer scope a driver PINNED, held at BOOT against the amphora the
// deployment handed pylon — driven through a real `Pylon.setup()` rather than
// the validator alone, because the point of the rule is that a deployment
// pinning a scope amphora does not hold cannot start. Without it the process
// comes up on a warning and 500s the first request that reaches the issuer.

import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import { afterEach, describe, expect, test } from "vitest";
import { IDP_SETTINGS, nockIdp } from "../__fixtures__/idp.js";
import { JwtDriver } from "../drivers/auth/JwtDriver.js";
import { OpenIdResourceDriver } from "../drivers/auth/OpenIdResourceDriver.js";
import type { PylonSettings } from "../types/index.js";
import { Pylon } from "./Pylon.js";

axios.defaults.proxy = false;

const ISSUER = "http://test.lindorm.io";

nockIdp();

type Options = {
  scope: "self" | "idp";
  internal?: boolean;
  idp?: boolean;
};

let pylons: Array<Pylon> = [];

afterEach(async () => {
  for (const pylon of pylons) {
    await pylon.stop().catch(() => undefined);
  }
  pylons = [];
});

const createAmphora = (logger: ILogger, options: Options): IAmphora =>
  new Amphora({
    logger,
    ...(options.internal ? { internal: { issuer: ISSUER } } : {}),
    ...(options.idp ? { idp: IDP_SETTINGS } : {}),
  });

const createPylon = (options: Options): Pylon => {
  const logger = createMockLogger();

  const settings: PylonSettings = {
    logger,
    amphora: createAmphora(logger, options),
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon-auth-issuer-test",
    port: 0,
    version: "0.0.1",
    auth: { driver: new JwtDriver({ issuer: options.scope }) },
  };

  const pylon = new Pylon(settings);
  pylons.push(pylon);
  return pylon;
};

describe("Pylon auth issuer", () => {
  describe('a driver pinned to "self"', () => {
    test("should refuse to boot when amphora declares no issuer of its own", async () => {
      const pylon = createPylon({ scope: "self" });

      await expect(pylon.setup()).rejects.toMatchObject({
        code: "self_issuer_not_configured",
      });
    });

    test("should boot when amphora holds the internal issuer", async () => {
      const pylon = createPylon({ scope: "self", internal: true });

      await expect(pylon.setup()).resolves.toBeUndefined();
    });
  });

  describe('a driver pinned to "idp"', () => {
    test("should refuse to boot when no upstream is registered", async () => {
      const pylon = createPylon({ scope: "idp", internal: true });

      await expect(pylon.setup()).rejects.toMatchObject({
        code: "idp_not_configured",
      });
    });

    // ⚠ The check that fires on correct configuration is the worse failure:
    // amphora has fetched by the time it runs, so a registered upstream is
    // resolved and there is nothing left to object to.
    test("should boot when an upstream is registered", async () => {
      const pylon = createPylon({ scope: "idp", internal: true, idp: true });

      await expect(pylon.setup()).resolves.toBeUndefined();
    });
  });

  // The most common deployment shape, and the one that used to boot into a
  // warning: a discovery-backed driver has no issuer, no discovery document and
  // no negotiated auth methods without a registered upstream.
  describe("a discovery-backed driver", () => {
    const build = (idp: boolean): Pylon => {
      const logger = createMockLogger();

      const pylon = new Pylon({
        logger,
        amphora: createAmphora(logger, { scope: "idp", internal: true, idp }),
        domain: ISSUER,
        environment: "test",
        name: "@lindorm/pylon-auth-issuer-test",
        port: 0,
        version: "0.0.1",
        auth: { driver: new OpenIdResourceDriver({ clientId: "client-id" }) },
      });

      pylons.push(pylon);
      return pylon;
    };

    test("should refuse to boot when no upstream is registered", async () => {
      await expect(build(false).setup()).rejects.toMatchObject({
        code: "idp_not_configured",
      });
    });

    test("should boot when one is registered", async () => {
      await expect(build(true).setup()).resolves.toBeUndefined();
    });
  });
});

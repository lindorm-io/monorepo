import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { IPylonAuthDriver } from "../../interfaces/index.js";
import { createAuthDriverContext } from "../../internal/utils/auth/create-auth-driver-context.js";
import type { PylonAuthDriverContext } from "../../types/index.js";
import { OpenIdResourceDriver } from "./OpenIdResourceDriver.js";

axios.defaults.proxy = false;

const ISSUER = "https://auth.lindorm.io";

describe("OpenIdResourceDriver", () => {
  let context: PylonAuthDriverContext;
  let driver: OpenIdResourceDriver;
  let openIdConfiguration: Partial<OpenIdConfiguration>;
  let observed: { authorization?: string; body?: unknown; contentType?: string };

  const fields = (): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(observed.body as string));

  beforeEach(() => {
    observed = {};
    nock.cleanAll();

    openIdConfiguration = {
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/token`,
      jwksUri: `${ISSUER}/jwks`,
      userinfoEndpoint: `${ISSUER}/userinfo`,
      introspectionEndpoint: `${ISSUER}/introspect`,
    };

    context = createAuthDriverContext({
      amphora: { idp: { config: () => ({ issuer: ISSUER, openIdConfiguration }) } },
      logger: createMockLogger(),
      state: {
        app: { environment: "test" },
        metadata: { correlationId: "test-correlation" },
      },
    } as any);

    driver = new OpenIdResourceDriver({
      clientId: "resource-server",
      clientSecret: "resource-secret",
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  /**
   * The absence IS the capability declaration. Pylon reads exactly this at boot
   * to refuse to mount an auth router this driver cannot serve — a throwing stub
   * would make every driver *have* every method and kill that check.
   */
  describe("declared capabilities", () => {
    // Asserted through the INTERFACE, because that is the only type pylon ever
    // holds a driver as: `PylonAuthSettings.driver` is an `IPylonAuthDriver` and
    // boot validation reads `if (!driver.authorize)` off exactly this view.
    // (Against the concrete class the compiler refuses the read outright, which
    // is the same guarantee one layer earlier.)
    let contract: IPylonAuthDriver;

    beforeEach(() => {
      contract = driver;
    });

    test("should not implement the relying party methods", () => {
      expect(contract.authorize).toBeUndefined();
      expect(contract.exchange).toBeUndefined();
      expect(contract.refresh).toBeUndefined();
      expect(contract.clientCredentials).toBeUndefined();
      expect(contract.logout).toBeUndefined();
    });

    test("should not inherit them through a prototype chain", () => {
      expect("authorize" in driver).toBe(false);
      expect("exchange" in driver).toBe(false);
    });

    test("should implement the resource server methods", () => {
      expect(contract.endpoints).toEqual(expect.any(Function));
      expect(contract.introspect).toEqual(expect.any(Function));
      expect(contract.userinfo).toEqual(expect.any(Function));
      expect(contract.subject).toEqual(expect.any(Function));
    });

    // It never runs an authorization request, so it declares no PKCE either.
    test("should declare no pkce method", () => {
      expect(contract.pkce).toBeUndefined();
    });
  });

  test("should resolve the same endpoints as the relying party driver", () => {
    expect(driver.endpoints(context)).toMatchSnapshot();
  });

  test("should introspect with its OWN credentials", async () => {
    const scope = nock(ISSUER)
      .post("/introspect")
      .reply(200, function (_uri, requestBody) {
        observed = {
          authorization: this.req.headers["authorization"],
          body: requestBody,
          contentType: this.req.headers["content-type"],
        };
        return { active: true, sub: "user-123" };
      });

    const result = await driver.introspect(context, { token: "access-token" });

    expect(observed.contentType).toBe("application/x-www-form-urlencoded");
    expect(observed.authorization).toBe(
      `Basic ${Buffer.from("resource-server:resource-secret").toString("base64")}`,
    );
    expect(fields()).toEqual({ token: "access-token" });
    expect(result).toEqual({ active: true, subject: "user-123" });
    expect(scope.isDone()).toBe(true);
  });

  // RFC 8414 §2 gives the introspection endpoint its own methods list.
  test("should negotiate from introspectionEndpointAuthMethodsSupported", async () => {
    openIdConfiguration.introspectionEndpointAuthMethodsSupported = [
      "client_secret_post",
    ];
    openIdConfiguration.tokenEndpointAuthMethodsSupported = ["client_secret_basic"];

    nock(ISSUER)
      .post("/introspect")
      .reply(200, function (_uri, requestBody) {
        observed = {
          authorization: this.req.headers["authorization"],
          body: requestBody,
        };
        return { active: true, sub: "user-123" };
      });

    await driver.introspect(context, { token: "access-token" });

    expect(observed.authorization).toBeUndefined();
    expect(fields().client_secret).toBe("resource-secret");
  });

  test("should fetch userinfo", async () => {
    nock(ISSUER)
      .get("/userinfo")
      .matchHeader("authorization", "Bearer access-token")
      .reply(200, { sub: "user-123", given_name: "John" });

    await expect(
      driver.userinfo(context, { accessToken: "access-token" }),
    ).resolves.toEqual({ givenName: "John", subject: "user-123" });
  });

  test("should resolve the subject behind an opaque token", async () => {
    nock(ISSUER).get("/userinfo").reply(200, { sub: "user-123" });

    await expect(driver.subject(context, { accessToken: "opaque" })).resolves.toBe(
      "user-123",
    );
  });
});

import { ClientError, ServerError } from "@lindorm/errors";
import { createWellKnownRouter } from "./create-well-known-router";

describe("createWellKnownRouter", () => {
  const defaultOptions: any = {
    domain: "https://test.lindorm.io",
    changePasswordUri: "https://test.lindorm.io/change-password",
    cors: { origin: "*" },
    environment: "test",
    maxRequestAge: 30000,
    name: "test-service",
    version: "1.0.0",
    openIdConfiguration: {
      authorization_endpoint: "<DOMAIN>/auth",
      token_endpoint: "<ORIGIN>/token",
    },
  };

  test("should create a router with expected routes", () => {
    const router = createWellKnownRouter(defaultOptions);
    const paths = router.stack.map((l) => l.path);

    expect(paths).toMatchSnapshot();
  });

  describe("change-password", () => {
    test("should redirect when changePasswordUri is configured", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/change-password");

      const ctx: any = { redirect: jest.fn() };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.redirect).toHaveBeenCalledWith(
        "https://test.lindorm.io/change-password",
      );
    });

    test("should throw ServerError when changePasswordUri is not configured", async () => {
      const router = createWellKnownRouter({
        ...defaultOptions,
        changePasswordUri: undefined,
      });
      const layer = router.stack.find((l) => l.path === "/change-password");

      const ctx: any = { redirect: jest.fn() };
      const next = jest.fn();

      await expect(async () => {
        for (const mw of layer!.stack) {
          await mw(ctx, next);
        }
      }).rejects.toThrow(ServerError);
    });
  });

  describe("jwks.json", () => {
    test("should return jwks from amphora", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/jwks.json");

      const jwks = { keys: [{ kid: "test-key" }] };
      const ctx: any = { amphora: { jwks }, body: null, status: 0 };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.body).toBe(jwks);
      expect(ctx.status).toBe(200);
    });
  });

  describe("openid-configuration", () => {
    test("should return openid configuration with domain replaced", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/openid-configuration");

      const ctx: any = {
        body: null,
        status: 0,
        state: { origin: "https://origin.lindorm.io" },
      };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchSnapshot();
    });
  });

  describe("pylon-configuration", () => {
    test("should return pylon configuration", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/pylon-configuration");

      const ctx: any = { body: null, status: 0 };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchSnapshot();
    });
  });

  describe("right-to-be-forgotten", () => {
    test("should invoke callback when authorization type is bearer", async () => {
      const rightToBeForgotten = jest.fn();
      const options = {
        ...defaultOptions,
        callbacks: { rightToBeForgotten },
      };

      const router = createWellKnownRouter(options);
      const layer = router.stack.find((l) => l.path === "/right-to-be-forgotten");

      const ctx: any = {
        body: null,
        status: 0,
        state: { authorization: { type: "bearer" } },
      };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(rightToBeForgotten).toHaveBeenCalledWith(ctx);
      expect(ctx.status).toBe(204);
      expect(ctx.body).toBeUndefined();
    });

    test("should throw ClientError when authorization type is not bearer", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/right-to-be-forgotten");

      const ctx: any = {
        body: null,
        status: 0,
        state: { authorization: { type: "basic" } },
      };
      const next = jest.fn();

      await expect(async () => {
        for (const mw of layer!.stack) {
          await mw(ctx, next);
        }
      }).rejects.toThrow(ClientError);
    });

    test("should set 204 without callback when none configured", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/right-to-be-forgotten");

      const ctx: any = {
        body: "something",
        status: 0,
        state: { authorization: { type: "bearer" } },
      };
      const next = jest.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.status).toBe(204);
      expect(ctx.body).toBeUndefined();
    });
  });
});

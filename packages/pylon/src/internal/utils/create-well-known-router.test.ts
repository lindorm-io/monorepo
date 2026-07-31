import { ClientError, ServerError } from "@lindorm/errors";
import type { PylonSecurityTxt } from "../../types/index.js";
import { createWellKnownRouter } from "./create-well-known-router.js";
import { describe, expect, test, vi } from "vitest";

describe("createWellKnownRouter", () => {
  const defaultOptions: any = {
    domain: "https://test.lindorm.io",
    changePasswordUri: "https://test.lindorm.io/change-password",
    cors: { origin: "*" },
    environment: "test",
    maxRequestAge: 30000,
    name: "test-service",
    version: "1.0.0",
    auth: { issuer: "https://auth.lindorm.io" },
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

      const ctx: any = { redirect: vi.fn() };
      const next = vi.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.redirect).toHaveBeenCalledWith(
        "https://test.lindorm.io/change-password",
      );
    });

    test("should throw ClientError when changePasswordUri is not configured", async () => {
      const router = createWellKnownRouter({
        ...defaultOptions,
        changePasswordUri: undefined,
      });
      const layer = router.stack.find((l) => l.path === "/change-password");

      const ctx: any = { redirect: vi.fn() };
      const next = vi.fn();

      await expect(async () => {
        for (const mw of layer!.stack) {
          await mw(ctx, next);
        }
      }).rejects.toThrow(ClientError);
    });
  });

  describe("jwks.json", () => {
    test("should return jwks from amphora", async () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/jwks.json");

      const jwks = { keys: [{ kid: "test-key" }] };
      const ctx: any = { amphora: { jwks }, body: null, status: 0 };
      const next = vi.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.body).toBe(jwks);
      expect(ctx.status).toBe(200);
    });
  });

  describe("oauth-protected-resource", () => {
    const invoke = async (options: any): Promise<any> => {
      const router = createWellKnownRouter(options);
      const layer = router.stack.find((l) => l.path === "/oauth-protected-resource");

      const ctx: any = { body: null, status: 0 };
      const next = vi.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      return ctx;
    };

    test("should return RFC 9728 protected resource metadata", async () => {
      const ctx = await invoke(defaultOptions);

      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchSnapshot();
    });

    test("should throw ClientError when domain is not configured", async () => {
      await expect(invoke({ ...defaultOptions, domain: undefined })).rejects.toThrow(
        ClientError,
      );
    });

    test("should throw ClientError when auth issuer is not configured", async () => {
      await expect(invoke({ ...defaultOptions, auth: undefined })).rejects.toThrow(
        ClientError,
      );
    });
  });

  describe("right-to-be-forgotten", () => {
    test("should invoke callback when authorization type is bearer", async () => {
      const rightToBeForgotten = vi.fn();
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
      const next = vi.fn();

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
      const next = vi.fn();

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
      const next = vi.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.status).toBe(204);
      expect(ctx.body).toBeUndefined();
    });
  });

  describe("security.txt", () => {
    const futureDate = (): Date => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date;
    };

    const fixedExpires = futureDate();

    const securityTxt: PylonSecurityTxt = {
      contact: "mailto:security@example.com",
      expires: fixedExpires,
      canonical: "https://example.com/.well-known/security.txt",
      encryption: "https://example.com/pgp-key.txt",
      preferredLanguages: ["en", "sv"],
    };

    test("should not register the route when securityTxt is unset", () => {
      const router = createWellKnownRouter(defaultOptions);
      const layer = router.stack.find((l) => l.path === "/security.txt");

      expect(layer).toBeUndefined();
    });

    test("should register the route when securityTxt is set", () => {
      const router = createWellKnownRouter({ ...defaultOptions, securityTxt });
      const layer = router.stack.find((l) => l.path === "/security.txt");

      expect(layer).toBeDefined();
    });

    test("should serve the rendered body with expected content-type and status", async () => {
      const router = createWellKnownRouter({ ...defaultOptions, securityTxt });
      const layer = router.stack.find((l) => l.path === "/security.txt");

      const ctx: any = { body: null, status: 0, type: "" };
      const next = vi.fn();

      for (const mw of layer!.stack) {
        await mw(ctx, next);
      }

      expect(ctx.status).toBe(200);
      expect(ctx.type).toBe("text/plain; charset=utf-8");
      expect(ctx.body).toContain("Contact: mailto:security@example.com");
      expect(ctx.body).toContain(`Expires: ${fixedExpires.toISOString()}`);
      expect(ctx.body).toContain(
        "Canonical: https://example.com/.well-known/security.txt",
      );
      expect(ctx.body).toContain("Encryption: https://example.com/pgp-key.txt");
      expect(ctx.body).toContain("Preferred-Languages: en, sv");
    });

    test("should throw when expires is in the past", () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);

      expect(() =>
        createWellKnownRouter({
          ...defaultOptions,
          securityTxt: {
            contact: "mailto:security@example.com",
            expires: past,
          },
        }),
      ).toThrow(ServerError);
    });

    test("should accept valid securityTxt with Date expires within window", () => {
      expect(() =>
        createWellKnownRouter({
          ...defaultOptions,
          securityTxt: {
            contact: "mailto:security@example.com",
            expires: futureDate(),
          },
        }),
      ).not.toThrow();
    });
  });
});

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ClientError } from "../errors/ClientError.js";
import { LindormError } from "../errors/LindormError.js";
import { ServerError } from "../errors/ServerError.js";
import { resetErrorRegistry } from "./__fixtures__/reset.js";
import { ErrorRegistry, errorRegistry } from "./ErrorRegistry.js";

class TestNotFoundError extends ClientError {
  public static readonly status = 404;

  public constructor(message: string, options = {}) {
    super(message, { ...options, status: 404 });
  }
}

class TestStatuslessError extends LindormError {
  public constructor(message: string, options = {}) {
    super(message, options);
  }
}

describe("ErrorRegistry", () => {
  beforeEach(() => {
    resetErrorRegistry();
  });

  afterEach(() => {
    resetErrorRegistry();
  });

  describe("register", () => {
    test("should register class by name and by status when status is a number", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.has("TestNotFoundError")).toBe(true);
      expect(errorRegistry.resolve({ name: "TestNotFoundError" })).toBe(
        TestNotFoundError,
      );
      expect(errorRegistry.resolve({ status: 404 })).toBe(TestNotFoundError);
    });

    test("should register by name only when status is not a number", () => {
      errorRegistry.register(TestStatuslessError);

      expect(errorRegistry.has("TestStatuslessError")).toBe(true);
      expect(errorRegistry.resolve({ name: "TestStatuslessError" })).toBe(
        TestStatuslessError,
      );
      expect(errorRegistry.resolve({ status: 999 })).toBe(LindormError);
    });

    test("should throw when class is anonymous", () => {
      const Anonymous = class extends LindormError {};
      Object.defineProperty(Anonymous, "name", { value: "" });

      expect(() => errorRegistry.register(Anonymous)).toThrow(LindormError);
      expect(() => errorRegistry.register(Anonymous)).toThrow(
        "Cannot register anonymous error class",
      );
    });
  });

  describe("resolve", () => {
    test("should resolve registered class by name", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.resolve({ name: "TestNotFoundError" })).toBe(
        TestNotFoundError,
      );
    });

    test("should resolve registered class by exact status", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.resolve({ status: 404 })).toBe(TestNotFoundError);
    });

    test("should fall back to ClientError for unknown 4xx status", () => {
      expect(errorRegistry.resolve({ status: 418 })).toBe(ClientError);
      expect(errorRegistry.resolve({ status: 451 })).toBe(ClientError);
    });

    test("should fall back to ServerError for unknown 5xx status", () => {
      expect(errorRegistry.resolve({ status: 500 })).toBe(ServerError);
      expect(errorRegistry.resolve({ status: 599 })).toBe(ServerError);
    });

    test("should fall back to LindormError for non-HTTP statuses", () => {
      expect(errorRegistry.resolve({ status: 200 })).toBe(LindormError);
      expect(errorRegistry.resolve({ status: 0 })).toBe(LindormError);
      expect(errorRegistry.resolve({ status: 399 })).toBe(LindormError);
      expect(errorRegistry.resolve({ status: 600 })).toBe(LindormError);
    });

    test("should fall back to LindormError when hint is empty", () => {
      expect(errorRegistry.resolve({})).toBe(LindormError);
    });

    test("should prefer name match over status range fallback", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.resolve({ name: "TestNotFoundError", status: 500 })).toBe(
        TestNotFoundError,
      );
    });

    test("should fall through to status when name is unknown", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.resolve({ name: "UnknownError", status: 404 })).toBe(
        TestNotFoundError,
      );
    });
  });

  describe("reconstruct", () => {
    test("should reconstruct an instance of the resolved class with all fields propagated", () => {
      errorRegistry.register(TestNotFoundError);

      const error = errorRegistry.reconstruct({
        id: "aaf972cc-6fbf-54c3-8706-2bea9fb0c1d4",
        code: "missing_resource",
        data: { resource: "user" },
        debug: { trace: "id-1" },
        message: "user not found",
        name: "TestNotFoundError",
        status: 404,
        support: "support-token",
        title: "Custom Title",
      });

      expect(error).toBeInstanceOf(TestNotFoundError);
      expect(error).toBeInstanceOf(ClientError);
      expect(error).toBeInstanceOf(LindormError);

      expect(error.toJSON()).toMatchSnapshot({
        stack: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    test("should reconstruct as ClientError for unknown 4xx", () => {
      const error = errorRegistry.reconstruct({
        message: "teapot",
        status: 418,
      });

      expect(error).toBeInstanceOf(ClientError);
      expect(error.status).toBe(418);
    });

    test("should reconstruct as ServerError for unknown 5xx", () => {
      const error = errorRegistry.reconstruct({
        message: "boom",
        status: 503,
      });

      expect(error).toBeInstanceOf(ServerError);
      expect(error.status).toBe(503);
    });

    test("should reconstruct as LindormError when no hints match", () => {
      const error = errorRegistry.reconstruct({
        message: "generic",
      });

      expect(error).toBeInstanceOf(LindormError);
      expect(error.message).toBe("generic");
    });
  });

  describe("has", () => {
    test("should return true for registered class", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.has("TestNotFoundError")).toBe(true);
    });

    test("should return false for unregistered class", () => {
      expect(errorRegistry.has("TestNotFoundError")).toBe(false);
    });
  });

  describe("unregister", () => {
    test("should remove a registered class by name and status", () => {
      errorRegistry.register(TestNotFoundError);

      expect(errorRegistry.unregister("TestNotFoundError")).toBe(true);
      expect(errorRegistry.has("TestNotFoundError")).toBe(false);
      expect(errorRegistry.resolve({ status: 404 })).toBe(ClientError);
    });

    test("should return false when class is not registered", () => {
      expect(errorRegistry.unregister("Nope")).toBe(false);
    });

    test("should remove only by name when class has no status", () => {
      errorRegistry.register(TestStatuslessError);

      expect(errorRegistry.unregister("TestStatuslessError")).toBe(true);
      expect(errorRegistry.has("TestStatuslessError")).toBe(false);
    });
  });

  describe("instance", () => {
    test("should export ErrorRegistry as constructable class", () => {
      const local = new ErrorRegistry();
      local.register(TestNotFoundError);

      expect(local.has("TestNotFoundError")).toBe(true);
      expect(errorRegistry.has("TestNotFoundError")).toBe(false);
    });
  });
});

import { PylonCookie } from "./PylonCookie";
import { describe, expect, test } from "vitest";

describe("PylonCookie", () => {
  const defaultOptions: any = {};

  describe("constructor", () => {
    test("should create a cookie with name and value", () => {
      const cookie = new PylonCookie("test", "value", defaultOptions);

      expect(cookie.name).toBe("test");
      expect(cookie.toString()).toBe("test=value");
    });

    test("should create a cookie with null value", () => {
      const cookie = new PylonCookie("test", null, defaultOptions);

      expect(cookie.toString()).toBe("test=");
    });

    test("should create a cookie with all options", () => {
      const cookie = new PylonCookie("session", "abc123", {
        domain: "example.com",
        expiry: "1h",
        httpOnly: true,
        partitioned: true,
        path: "/api",
        priority: "high",
        sameSite: "strict",
        secure: true,
      });

      expect(cookie.name).toBe("session");
    });
  });

  describe("toString", () => {
    test("should return name=value format", () => {
      const cookie = new PylonCookie("foo", "bar", defaultOptions);

      expect(cookie.toString()).toBe("foo=bar");
    });

    test("should return name= for empty value", () => {
      const cookie = new PylonCookie("foo", null, defaultOptions);

      expect(cookie.toString()).toBe("foo=");
    });
  });

  describe("toHeader", () => {
    test("should return basic header with only name and value", () => {
      const cookie = new PylonCookie("test", "value", defaultOptions);

      expect(cookie.toHeader()).toMatchSnapshot();
    });

    test("should include domain when set", () => {
      const cookie = new PylonCookie("test", "value", {
        domain: "example.com",
      });

      expect(cookie.toHeader()).toMatchSnapshot();
    });

    test("should include path", () => {
      const cookie = new PylonCookie("test", "value", {
        path: "/api",
      });

      expect(cookie.toHeader()).toMatchSnapshot();
    });

    test("should include default path /", () => {
      const cookie = new PylonCookie("test", "value", defaultOptions);

      expect(cookie.toHeader()).toContain("path=/");
    });

    test("should include expires when expiry is a Date", () => {
      const date = new Date("2026-12-31T00:00:00.000Z");
      const cookie = new PylonCookie("test", "value", {
        expiry: date,
      });

      expect(cookie.toHeader()).toContain("expires=Thu, 31 Dec 2026 00:00:00 GMT");
    });

    test("should include expires when expiry is a string", () => {
      const cookie = new PylonCookie("test", "value", {
        expiry: "1h",
      });

      expect(cookie.toHeader()).toContain("expires=");
    });

    test("should include priority when set", () => {
      const cookie = new PylonCookie("test", "value", {
        priority: "high",
      });

      expect(cookie.toHeader()).toMatchSnapshot();
    });

    test("should include sameSite when set", () => {
      const cookie = new PylonCookie("test", "value", {
        sameSite: "lax",
      });

      expect(cookie.toHeader()).toMatchSnapshot();
    });

    test("should include secure flag", () => {
      const cookie = new PylonCookie("test", "value", {
        secure: true,
      });

      expect(cookie.toHeader()).toContain("secure");
    });

    test("should not include secure flag when false", () => {
      const cookie = new PylonCookie("test", "value", {
        secure: false,
      });

      expect(cookie.toHeader()).not.toContain("secure");
    });

    test("should include httponly flag", () => {
      const cookie = new PylonCookie("test", "value", {
        httpOnly: true,
      });

      expect(cookie.toHeader()).toContain("httponly");
    });

    test("should include partitioned flag", () => {
      const cookie = new PylonCookie("test", "value", {
        partitioned: true,
      });

      expect(cookie.toHeader()).toContain("partitioned");
    });

    test("should include all attributes when set", () => {
      const cookie = new PylonCookie("session", "abc123", {
        domain: "example.com",
        expiry: new Date("2026-12-31T00:00:00.000Z"),
        httpOnly: true,
        partitioned: true,
        path: "/app",
        priority: "medium",
        sameSite: "none",
        secure: true,
      });

      expect(cookie.toHeader()).toMatchSnapshot();
    });
  });

  describe("validation", () => {
    test("should throw on invalid cookie name with restricted characters", () => {
      expect(() => new PylonCookie("bad;name", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on invalid cookie name with equals sign", () => {
      expect(() => new PylonCookie("bad=name", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name", () => {
      expect(() => new PylonCookie("domain", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name (case insensitive)", () => {
      expect(() => new PylonCookie("Expires", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: path", () => {
      expect(() => new PylonCookie("path", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: secure", () => {
      expect(() => new PylonCookie("secure", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: httponly", () => {
      expect(() => new PylonCookie("httponly", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: samesite", () => {
      expect(() => new PylonCookie("samesite", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: priority", () => {
      expect(() => new PylonCookie("priority", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: partitioned", () => {
      expect(() => new PylonCookie("partitioned", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on restricted cookie name: max-age", () => {
      expect(() => new PylonCookie("max-age", "value", defaultOptions)).toThrow(
        "Invalid cookie name",
      );
    });

    test("should throw on cookie value with semicolon", () => {
      expect(() => new PylonCookie("test", "bad;value", defaultOptions)).toThrow(
        "Invalid cookie value",
      );
    });

    test("should throw on invalid domain (control characters)", () => {
      expect(() => new PylonCookie("test", "value", { domain: "bad\x00domain" })).toThrow(
        "Invalid cookie domain",
      );
    });

    test("should throw on invalid path (control characters)", () => {
      expect(() => new PylonCookie("test", "value", { path: "bad\x00path" })).toThrow(
        "Invalid cookie path",
      );
    });

    test("should throw on invalid priority", () => {
      expect(
        () => new PylonCookie("test", "value", { priority: "invalid" as any }),
      ).toThrow("Invalid cookie priority");
    });

    test("should throw on invalid sameSite", () => {
      expect(
        () => new PylonCookie("test", "value", { sameSite: "invalid" as any }),
      ).toThrow("Invalid cookie sameSite");
    });

    test("should throw on invalid expiry", () => {
      expect(() => new PylonCookie("test", "value", { expiry: 12345 as any })).toThrow(
        "Invalid cookie expiry",
      );
    });

    test("should throw on empty cookie name", () => {
      expect(() => new PylonCookie("", "value", defaultOptions)).toThrow();
    });

    test("should accept valid priority values", () => {
      expect(() => new PylonCookie("t", "v", { priority: "low" })).not.toThrow();
      expect(() => new PylonCookie("t", "v", { priority: "medium" })).not.toThrow();
      expect(() => new PylonCookie("t", "v", { priority: "high" })).not.toThrow();
    });

    test("should accept valid sameSite values", () => {
      expect(() => new PylonCookie("t", "v", { sameSite: "strict" })).not.toThrow();
      expect(() => new PylonCookie("t", "v", { sameSite: "lax" })).not.toThrow();
      expect(() => new PylonCookie("t", "v", { sameSite: "none" })).not.toThrow();
    });
  });
});

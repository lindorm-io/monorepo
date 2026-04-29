import { classifyPostgresError } from "./classify-breaker-error.js";
import { describe, expect, it } from "vitest";

describe("classifyPostgresError", () => {
  describe("transient postgres codes", () => {
    const transientCodes = [
      { code: "08000", label: "connection_exception" },
      { code: "08003", label: "connection_does_not_exist" },
      { code: "08006", label: "connection_failure" },
      { code: "57P01", label: "admin_shutdown" },
      { code: "57P02", label: "crash_shutdown" },
      { code: "57P03", label: "cannot_connect_now" },
      { code: "53300", label: "too_many_connections" },
      { code: "53400", label: "configuration_limit_exceeded" },
    ];

    it.each(transientCodes)("should classify $code ($label) as transient", ({ code }) => {
      const error = Object.assign(new Error("pg error"), { code });
      expect(classifyPostgresError(error)).toBe("transient");
    });
  });

  describe("permanent postgres codes", () => {
    const permanentCodes = [
      { code: "28000", label: "invalid_authorization_specification" },
      { code: "28P01", label: "invalid_password" },
      { code: "3D000", label: "invalid_catalog_name" },
      { code: "3F000", label: "invalid_schema_name" },
    ];

    it.each(permanentCodes)("should classify $code ($label) as permanent", ({ code }) => {
      const error = Object.assign(new Error("pg error"), { code });
      expect(classifyPostgresError(error)).toBe("permanent");
    });
  });

  describe("transient system codes", () => {
    const systemCodes = [
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "EPIPE",
      "EAI_AGAIN",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ];

    it.each(systemCodes)("should classify %s as transient", (code) => {
      const error = Object.assign(new Error("system error"), { code });
      expect(classifyPostgresError(error)).toBe("transient");
    });
  });

  describe("transient message patterns", () => {
    it("should classify 'Connection terminated unexpectedly' as transient", () => {
      const error = new Error("Connection terminated unexpectedly");
      expect(classifyPostgresError(error)).toBe("transient");
    });

    it("should classify 'connection timeout' as transient", () => {
      const error = new Error("connection timeout expired");
      expect(classifyPostgresError(error)).toBe("transient");
    });
  });

  describe("ignorable errors", () => {
    it("should classify constraint violations as ignorable", () => {
      const error = Object.assign(new Error("unique constraint violation"), {
        code: "23505",
      });
      expect(classifyPostgresError(error)).toBe("ignorable");
    });

    it("should classify unknown error codes as ignorable", () => {
      const error = Object.assign(new Error("some error"), { code: "99999" });
      expect(classifyPostgresError(error)).toBe("ignorable");
    });

    it("should classify errors with no code as ignorable", () => {
      const error = new Error("some random error");
      expect(classifyPostgresError(error)).toBe("ignorable");
    });
  });
});

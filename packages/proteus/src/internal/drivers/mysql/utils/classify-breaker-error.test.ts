import { classifyMysqlError } from "./classify-breaker-error";
import { describe, expect, it } from "vitest";

describe("classifyMysqlError", () => {
  describe("transient mysql errno", () => {
    const transientErrnos = [
      { errno: 1040, label: "ER_CON_COUNT_ERROR" },
      { errno: 1053, label: "ER_SERVER_SHUTDOWN" },
      { errno: 1152, label: "ER_ABORTING_CONNECTION" },
      { errno: 1153, label: "ER_NET_PACKET_TOO_LARGE" },
      { errno: 1159, label: "ER_NET_READ_INTERRUPTED" },
      { errno: 1160, label: "ER_NET_ERROR_ON_WRITE" },
      { errno: 1161, label: "ER_NET_WRITE_INTERRUPTED" },
      { errno: 2002, label: "CR_CONNECTION_ERROR" },
      { errno: 2003, label: "CR_CONN_HOST_ERROR" },
      { errno: 2006, label: "CR_SERVER_GONE_ERROR" },
      { errno: 2013, label: "CR_SERVER_LOST" },
    ];

    it.each(transientErrnos)(
      "should classify errno $errno ($label) as transient",
      ({ errno }) => {
        const error = Object.assign(new Error("mysql error"), { errno });
        expect(classifyMysqlError(error)).toBe("transient");
      },
    );
  });

  describe("permanent mysql errno", () => {
    const permanentErrnos = [
      { errno: 1045, label: "ER_ACCESS_DENIED_ERROR" },
      { errno: 1049, label: "ER_BAD_DB_ERROR" },
    ];

    it.each(permanentErrnos)(
      "should classify errno $errno ($label) as permanent",
      ({ errno }) => {
        const error = Object.assign(new Error("mysql error"), { errno });
        expect(classifyMysqlError(error)).toBe("permanent");
      },
    );
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
      expect(classifyMysqlError(error)).toBe("transient");
    });
  });

  describe("transient message patterns", () => {
    it("should classify 'Connection lost' as transient", () => {
      const error = new Error("Connection lost: The server closed the connection.");
      expect(classifyMysqlError(error)).toBe("transient");
    });
  });

  describe("ignorable errors", () => {
    it("should classify unknown errno as ignorable", () => {
      const error = Object.assign(new Error("some error"), { errno: 9999 });
      expect(classifyMysqlError(error)).toBe("ignorable");
    });

    it("should classify errors with no errno or code as ignorable", () => {
      const error = new Error("some random error");
      expect(classifyMysqlError(error)).toBe("ignorable");
    });

    it("should classify duplicate entry errors as ignorable", () => {
      const error = Object.assign(new Error("Duplicate entry"), { errno: 1062 });
      expect(classifyMysqlError(error)).toBe("ignorable");
    });
  });
});

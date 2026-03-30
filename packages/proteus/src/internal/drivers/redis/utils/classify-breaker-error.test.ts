import { classifyRedisError } from "./classify-breaker-error";

describe("classifyRedisError", () => {
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
      expect(classifyRedisError(error)).toBe("transient");
    });
  });

  describe("transient message patterns", () => {
    const transientMessages = [
      "LOADING Redis is loading the dataset in memory",
      "BUSY Redis is busy with a background operation",
      "Connection is closed",
      "Stream isn't writeable",
    ];

    it.each(transientMessages)(
      "should classify message containing '%s' as transient",
      (message) => {
        const error = new Error(message);
        expect(classifyRedisError(error)).toBe("transient");
      },
    );
  });

  describe("permanent message patterns", () => {
    const permanentMessages = [
      "NOAUTH Authentication required",
      "NOPERM User has no permissions to run this command",
    ];

    it.each(permanentMessages)(
      "should classify message containing '%s' as permanent",
      (message) => {
        const error = new Error(message);
        expect(classifyRedisError(error)).toBe("permanent");
      },
    );
  });

  describe("ignorable errors", () => {
    it("should classify unknown errors as ignorable", () => {
      const error = new Error("WRONGTYPE Operation against a key holding the wrong kind");
      expect(classifyRedisError(error)).toBe("ignorable");
    });

    it("should classify errors with no code or recognized message as ignorable", () => {
      const error = new Error("some random error");
      expect(classifyRedisError(error)).toBe("ignorable");
    });

    it("should classify errors with unrecognized code as ignorable", () => {
      const error = Object.assign(new Error("some error"), { code: "UNKNOWN_CODE" });
      expect(classifyRedisError(error)).toBe("ignorable");
    });
  });

  describe("precedence", () => {
    it("should check system code before message patterns", () => {
      const error = Object.assign(new Error("NOAUTH Authentication required"), {
        code: "ECONNREFUSED",
      });
      expect(classifyRedisError(error)).toBe("transient");
    });

    it("should check permanent messages before transient messages", () => {
      const error = new Error("NOAUTH and LOADING both present");
      expect(classifyRedisError(error)).toBe("permanent");
    });
  });
});

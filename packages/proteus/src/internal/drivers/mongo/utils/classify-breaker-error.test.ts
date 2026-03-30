import { classifyMongoError } from "./classify-breaker-error";

describe("classifyMongoError", () => {
  describe("transient mongo codes", () => {
    const transientCodes = [
      { code: 6, label: "HostUnreachable" },
      { code: 7, label: "HostNotFound" },
      { code: 89, label: "NetworkTimeout" },
      { code: 91, label: "ShutdownInProgress" },
      { code: 189, label: "PrimarySteppedDown" },
      { code: 10107, label: "NotWritablePrimary" },
      { code: 11600, label: "InterruptedAtShutdown" },
      { code: 11602, label: "InterruptedDueToReplStateChange" },
      { code: 13435, label: "NotPrimaryNoSecondaryOk" },
      { code: 13436, label: "NotPrimaryOrSecondary" },
    ];

    it.each(transientCodes)(
      "should classify code $code ($label) as transient",
      ({ code }) => {
        const error = Object.assign(new Error("mongo error"), { code });
        expect(classifyMongoError(error)).toBe("transient");
      },
    );
  });

  describe("permanent mongo codes", () => {
    const permanentCodes = [
      { code: 13, label: "Unauthorized" },
      { code: 18, label: "AuthenticationFailed" },
    ];

    it.each(permanentCodes)(
      "should classify code $code ($label) as permanent",
      ({ code }) => {
        const error = Object.assign(new Error("mongo error"), { code });
        expect(classifyMongoError(error)).toBe("permanent");
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
      expect(classifyMongoError(error)).toBe("transient");
    });
  });

  describe("transient error labels", () => {
    it("should classify TransientTransactionError as transient", () => {
      const error = Object.assign(new Error("transaction error"), {
        hasErrorLabel: jest.fn().mockImplementation((label: string) => {
          return label === "TransientTransactionError";
        }),
      });
      expect(classifyMongoError(error)).toBe("transient");
    });

    it("should classify RetryableWriteError as transient", () => {
      const error = Object.assign(new Error("write error"), {
        hasErrorLabel: jest.fn().mockImplementation((label: string) => {
          return label === "RetryableWriteError";
        }),
      });
      expect(classifyMongoError(error)).toBe("transient");
    });
  });

  describe("transient message patterns", () => {
    it("should classify 'Server selection timed out' as transient", () => {
      const error = new Error("Server selection timed out after 30000ms");
      expect(classifyMongoError(error)).toBe("transient");
    });

    it("should classify 'connection pool cleared' as transient", () => {
      const error = new Error("connection pool cleared, retrying");
      expect(classifyMongoError(error)).toBe("transient");
    });
  });

  describe("ignorable errors", () => {
    it("should classify unknown numeric codes as ignorable", () => {
      const error = Object.assign(new Error("some error"), { code: 999 });
      expect(classifyMongoError(error)).toBe("ignorable");
    });

    it("should classify errors with no code as ignorable", () => {
      const error = new Error("some random error");
      expect(classifyMongoError(error)).toBe("ignorable");
    });

    it("should classify duplicate key errors as ignorable", () => {
      const error = Object.assign(new Error("E11000 duplicate key error"), {
        code: 11000,
      });
      expect(classifyMongoError(error)).toBe("ignorable");
    });
  });

  describe("precedence", () => {
    it("should check numeric code before system string code", () => {
      // A numeric code that is transient should take priority
      const error = Object.assign(new Error("error"), { code: 6 });
      expect(classifyMongoError(error)).toBe("transient");
    });

    it("should check error labels before message patterns", () => {
      const error = Object.assign(new Error("Server selection timed out"), {
        hasErrorLabel: jest.fn().mockImplementation((label: string) => {
          return label === "TransientTransactionError";
        }),
      });
      expect(classifyMongoError(error)).toBe("transient");
    });
  });
});

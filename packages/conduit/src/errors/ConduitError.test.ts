import { ConduitError } from "./ConduitError";

describe("ConduitError", () => {
  describe("isNetworkError", () => {
    test("should return true for network errors (status <= 0, no response)", () => {
      const error = new ConduitError("Network error", {
        status: -1,
        response: undefined,
      });

      expect(error.isNetworkError).toBe(true);
    });

    test("should return true for network errors (status 0, no response)", () => {
      const error = new ConduitError("Network error", {
        status: 0,
        response: undefined,
      });

      expect(error.isNetworkError).toBe(true);
    });

    test("should return false for HTTP errors (status 500, has response)", () => {
      const error = new ConduitError("Server error", {
        status: 500,
        response: { data: {}, headers: {}, status: 500 },
      });

      expect(error.isNetworkError).toBe(false);
    });

    test("should return false for HTTP errors (status 404, has response)", () => {
      const error = new ConduitError("Not found", {
        status: 404,
        response: { data: {}, headers: {}, status: 404 },
      });

      expect(error.isNetworkError).toBe(false);
    });

    test("should return false when status is negative but response exists", () => {
      const error = new ConduitError("Error", {
        status: -1,
        response: { data: {}, headers: {} },
      });

      expect(error.isNetworkError).toBe(false);
    });
  });

  describe("isClientError", () => {
    test("should return true for 4xx errors", () => {
      const error = new ConduitError("Client error", { status: 404 });

      expect(error.isClientError).toBe(true);
    });

    test("should return false for 5xx errors", () => {
      const error = new ConduitError("Server error", { status: 500 });

      expect(error.isClientError).toBe(false);
    });
  });

  describe("isServerError", () => {
    test("should return true for 5xx errors", () => {
      const error = new ConduitError("Server error", { status: 503 });

      expect(error.isServerError).toBe(true);
    });

    test("should return false for 4xx errors", () => {
      const error = new ConduitError("Client error", { status: 404 });

      expect(error.isServerError).toBe(false);
    });
  });
});

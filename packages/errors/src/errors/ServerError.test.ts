import { LindormError } from "./LindormError";
import { ServerError } from "./ServerError";

describe("ServerError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(LindormError));
    });

    test("should be an ServerError", () => {
      expect(new ServerError("message").name).toBe("ServerError");
    });
  });

  describe("options", () => {
    test("should automatically set status and title", () => {
      expect(new ServerError("message").status).toBe(500);
      expect(new ServerError("message").title).toBe("Internal Server Error");
    });

    test("should use status", () => {
      expect(new ServerError("message", { status: ServerError.Status.GatewayTimeout }).status).toBe(
        504,
      );
    });

    test("should use title", () => {
      expect(new ServerError("message", { title: "title" }).title).toBe("title");
    });
  });

  describe("static", () => {
    test("should get Status", () => {
      expect(ServerError.Status.NetworkConnectTimeoutError).toBe(599);
    });
  });
});

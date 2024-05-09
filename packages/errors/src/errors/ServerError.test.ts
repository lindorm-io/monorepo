import { LindormError } from "./LindormError";
import { ServerError } from "./ServerError";

describe("ServerError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ServerError("message")).toEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new ServerError("message")).toEqual(expect.any(LindormError));
    });

    test("should be an ServerError", () => {
      expect(new ServerError("message").name).toEqual("ServerError");
    });
  });

  describe("options", () => {
    test("should automatically set status and title", () => {
      expect(new ServerError("message").status).toEqual(500);
      expect(new ServerError("message").title).toEqual("Internal Server Error");
    });

    test("should use status", () => {
      expect(
        new ServerError("message", { status: ServerError.Status.GatewayTimeout }).status,
      ).toEqual(504);
    });

    test("should use title", () => {
      expect(new ServerError("message", { title: "title" }).title).toEqual("title");
    });
  });

  describe("static", () => {
    test("should get Status", () => {
      expect(ServerError.Status.NetworkConnectTimeoutError).toEqual(599);
    });
  });
});

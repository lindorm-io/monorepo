import { ExtendableError } from "./ExtendableError";
import { HttpStatusError } from "./HttpStatusError";
import { LindormError } from "./LindormError";
import { ServerError } from "./ServerError";

describe("ServerError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendableError", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(ExtendableError));
    });

    test("should be a LindormError", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(LindormError));
    });

    test("should be a HttpStatusError", () => {
      expect(new ServerError("message")).toStrictEqual(expect.any(HttpStatusError));
    });

    test("should be an ServerError", () => {
      expect(new ServerError("message").name).toBe("ServerError");
    });
  });

  describe("statusCode", () => {
    test("should automatically set statusCode and title", () => {
      expect(new ServerError("message").statusCode).toBe(500);
      expect(new ServerError("message").title).toBe("Internal Server Error");
    });

    test("should use statusCode", () => {
      expect(new ServerError("message", { statusCode: 501 }).statusCode).toBe(501);
    });

    test("should use title", () => {
      expect(new ServerError("message", { title: "title" }).title).toBe("title");
    });
  });

  describe("static", () => {
    test("should get StatusCode", () => {
      expect(ServerError.StatusCode.NOT_IMPLEMENTED).toBe(501);
    });
  });
});

import { ClientError } from "./ClientError";
import { ExtendableError } from "./ExtendableError";
import { HttpStatusError } from "./HttpStatusError";
import { LindormError } from "./LindormError";

describe("ClientError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendableError", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(ExtendableError));
    });

    test("should be a LindormError", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(LindormError));
    });

    test("should be a HttpStatusError", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(HttpStatusError));
    });

    test("should be an ClientError", () => {
      expect(new ClientError("message").name).toBe("ClientError");
    });
  });

  describe("options", () => {
    test("should automatically set statusCode and title", () => {
      expect(new ClientError("message").statusCode).toBe(400);
      expect(new ClientError("message").title).toBe("Bad Request");
    });

    test("should use statusCode", () => {
      expect(new ClientError("message", { statusCode: 401 }).statusCode).toBe(401);
    });

    test("should use title", () => {
      expect(new ClientError("message", { title: "title" }).title).toBe("title");
    });
  });

  describe("static", () => {
    test("should get StatusCode", () => {
      expect(ClientError.StatusCode.BAD_REQUEST).toBe(400);
    });
  });
});

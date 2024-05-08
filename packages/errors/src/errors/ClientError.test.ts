import { ClientError } from "./ClientError";
import { LindormError } from "./LindormError";

describe("ClientError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new ClientError("message")).toStrictEqual(expect.any(LindormError));
    });

    test("should be an ClientError", () => {
      expect(new ClientError("message").name).toBe("ClientError");
    });
  });

  describe("options", () => {
    test("should automatically set status and title", () => {
      expect(new ClientError("message").status).toBe(400);
      expect(new ClientError("message").title).toBe("Bad Request");
    });

    test("should use status", () => {
      expect(new ClientError("message", { status: ClientError.Status.Forbidden }).status).toBe(403);
    });

    test("should use title", () => {
      expect(new ClientError("message", { title: "title" }).title).toBe("title");
    });
  });

  describe("static", () => {
    test("should get Status", () => {
      expect(ClientError.Status.BadRequest).toBe(400);
    });
  });
});

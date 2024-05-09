import { ClientError } from "./ClientError";
import { LindormError } from "./LindormError";

describe("ClientError", () => {
  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ClientError("message")).toEqual(expect.any(Error));
    });

    test("should be a LindormError", () => {
      expect(new ClientError("message")).toEqual(expect.any(LindormError));
    });

    test("should be an ClientError", () => {
      expect(new ClientError("message").name).toEqual("ClientError");
    });
  });

  describe("options", () => {
    test("should automatically set status and title", () => {
      expect(new ClientError("message").status).toEqual(400);
      expect(new ClientError("message").title).toEqual("Bad Request");
    });

    test("should use status", () => {
      expect(new ClientError("message", { status: ClientError.Status.Forbidden }).status).toEqual(
        403,
      );
    });

    test("should use title", () => {
      expect(new ClientError("message", { title: "title" }).title).toEqual("title");
    });
  });

  describe("static", () => {
    test("should get Status", () => {
      expect(ClientError.Status.BadRequest).toEqual(400);
    });
  });
});

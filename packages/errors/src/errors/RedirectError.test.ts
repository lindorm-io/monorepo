import { ExtendableError } from "./ExtendableError";
import { RedirectError } from "./RedirectError";
import { LindormError } from "./LindormError";

describe("RedirectError", () => {
  const options = {
    code: "code",
    description: "description",
    redirect: "redirect",
    state: "state",
    uri: "uri",
  };

  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new RedirectError("message", options)).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendableError", () => {
      expect(new RedirectError("message", options)).toStrictEqual(expect.any(ExtendableError));
    });

    test("should be an LindormError", () => {
      expect(new RedirectError("message", options)).toStrictEqual(expect.any(LindormError));
    });

    test("should be a RedirectError", () => {
      expect(new RedirectError("message", options).name).toBe("RedirectError");
    });

    test("should set options", () => {
      expect(new RedirectError("message", options)).toStrictEqual(
        expect.objectContaining({
          code: "code",
          description: "description",
          redirect: "redirect",
          state: "state",
          uri: "uri",
        }),
      );
    });
  });
});

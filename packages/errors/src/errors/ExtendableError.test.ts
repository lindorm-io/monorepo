import { ExtendableError } from "./ExtendableError";

describe("ExtendableError", () => {
  class ExtendedError extends ExtendableError {
    public constructor(message: string) {
      super(message);
    }
  }

  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new ExtendedError("message")).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendedError", () => {
      expect(new ExtendedError("message").name).toBe("ExtendedError");
    });
  });
});

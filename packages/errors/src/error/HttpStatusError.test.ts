import { ExtendableError } from "./ExtendableError";
import { HttpStatusError as _HttpStatusError } from "./HttpStatusError";
import { LindormError } from "./LindormError";

describe("HttpStatusError", () => {
  class HttpStatusError extends _HttpStatusError {
    public constructor(message: string, options: any) {
      super(message, options);
    }
  }

  describe("instanceOf", () => {
    test("should be an Error", () => {
      expect(new HttpStatusError("message", { statusCode: 100 })).toStrictEqual(expect.any(Error));
    });

    test("should be an ExtendableError", () => {
      expect(new HttpStatusError("message", { statusCode: 100 })).toStrictEqual(
        expect.any(ExtendableError),
      );
    });

    test("should be a LindormError", () => {
      expect(new HttpStatusError("message", { statusCode: 100 })).toStrictEqual(
        expect.any(LindormError),
      );
    });

    test("should be a HttpStatusError", () => {
      expect(new HttpStatusError("message", { statusCode: 100 })).toStrictEqual(
        expect.any(HttpStatusError),
      );
    });
  });
});

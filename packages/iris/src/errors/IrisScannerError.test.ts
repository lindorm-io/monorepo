import { IrisError } from "./IrisError";
import { IrisScannerError } from "./IrisScannerError";

describe("IrisScannerError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisScannerError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisScannerError);
    expect(error.message).toBe("test");
  });
});

import { IrisError } from "./IrisError";
import { IrisTransportError } from "./IrisTransportError";

describe("IrisTransportError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisTransportError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisTransportError);
    expect(error.message).toBe("test");
  });
});

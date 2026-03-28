import { IrisError } from "./IrisError";
import { IrisSerializationError } from "./IrisSerializationError";

describe("IrisSerializationError", () => {
  it("should be an instance of IrisError", () => {
    const error = new IrisSerializationError("test");
    expect(error).toBeInstanceOf(IrisError);
    expect(error).toBeInstanceOf(IrisSerializationError);
    expect(error.message).toBe("test");
  });
});

import { randomBytes } from "crypto";
import { randomId } from "./random-id";

describe("randomId", () => {
  test("should resolve default", () => {
    const id = randomId();

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(22);
  });

  test("should resolve with timestamp", () => {
    const id = randomId({ timestamp: true });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(22);
  });

  test("should resolve with namespace", () => {
    const id = randomId({ namespace: "lindorm.io" });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(35);
  });

  test("should resolve with custom entropy", () => {
    const id = randomId({ entropy: 512 });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(86);
  });

  test("should throw on invalid bits", () => {
    expect(() => randomId({ entropy: 100 })).toThrow();
  });

  test("should throw on invalid bytes", () => {
    expect(() => randomId({ entropy: 24 })).toThrow();
  });

  test("should throw on invalid namespace", () => {
    expect(() => randomId({ namespace: randomBytes(512).toString("hex") })).toThrow();
  });
});

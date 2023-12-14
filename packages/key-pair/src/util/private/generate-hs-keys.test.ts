import { generateHsKeys } from "./generate-hs-keys";

describe("generateHsKeys", () => {
  test("should resolve with length", async () => {
    expect(generateHsKeys({ length: 128 })).toStrictEqual({
      privateKey: expect.any(String),
      type: "HS",
    });
  });

  test("should resolve", async () => {
    expect(generateHsKeys()).toStrictEqual({
      privateKey: expect.any(String),
      type: "HS",
    });
  });
});

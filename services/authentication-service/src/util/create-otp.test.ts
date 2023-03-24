import { createOtp } from "./create-otp";

describe("createOtp", () => {
  test("should return a random number async", async () => {
    await expect(createOtp(10)).resolves.toStrictEqual(expect.any(Number));
  });
});

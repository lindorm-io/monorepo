import { extractTokenDelegation } from "./extract-token-delegation";
import { describe, expect, test } from "vitest";

describe("extractTokenDelegation", () => {
  test("should return undelegated state when no act claim is present", () => {
    expect(extractTokenDelegation({})).toMatchSnapshot();
  });

  test("should return single-level actor chain", () => {
    expect(
      extractTokenDelegation({
        act: { sub: "service-1", iss: "https://issuer.example/" },
      }),
    ).toMatchSnapshot();
  });

  test("should walk three-level nested act chain outermost to deepest", () => {
    expect(
      extractTokenDelegation({
        act: {
          sub: "service-1",
          act: {
            sub: "service-2",
            act: {
              sub: "service-3",
            },
          },
        },
      }),
    ).toMatchSnapshot();
  });
});

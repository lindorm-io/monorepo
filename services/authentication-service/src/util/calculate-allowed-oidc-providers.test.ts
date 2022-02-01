import { calculateAllowedOidcProviders } from "./calculate-allowed-oidc-providers";
import { getTestLoginSession } from "../test/entity";

describe("calculateAllowedOidcProviders", () => {
  test("should resolve all OIDC providers", async () => {
    expect(calculateAllowedOidcProviders(getTestLoginSession())).toStrictEqual([
      "apple",
      "google",
      "microsoft",
    ]);
  });

  test("should resolve some OIDC providers", async () => {
    expect(
      calculateAllowedOidcProviders(getTestLoginSession({ amrValues: ["oidc_apple"] })),
    ).toStrictEqual(["google", "microsoft"]);
  });
});

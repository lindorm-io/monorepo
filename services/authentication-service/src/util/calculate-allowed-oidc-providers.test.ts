import { calculateAllowedOidcProviders } from "./calculate-allowed-oidc-providers";
import { createTestLoginSession } from "../fixtures/entity";

describe("calculateAllowedOidcProviders", () => {
  test("should resolve all OIDC providers", async () => {
    expect(calculateAllowedOidcProviders(createTestLoginSession())).toStrictEqual([
      "apple",
      "google",
      "microsoft",
    ]);
  });

  test("should resolve some OIDC providers", async () => {
    expect(
      calculateAllowedOidcProviders(createTestLoginSession({ amrValues: ["oidc_apple"] })),
    ).toStrictEqual(["google", "microsoft"]);
  });
});

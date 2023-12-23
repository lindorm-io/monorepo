import { PUBLIC_EC_JWK, PUBLIC_EC_PEM } from "../../../fixtures/ec-keys.fixture";
import { getEcJwk } from "./get-ec-jwk";

describe("getEcJwk", () => {
  test("should return jwk from jwk", () => {
    expect(getEcJwk(PUBLIC_EC_JWK)).toStrictEqual(PUBLIC_EC_JWK);
  });

  test("should return jwk from pem", () => {
    expect(getEcJwk(PUBLIC_EC_PEM)).toStrictEqual(expect.objectContaining(PUBLIC_EC_JWK));
  });
});

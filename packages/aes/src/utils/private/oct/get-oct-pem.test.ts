import { SYMMETRIC_OCT_JWK, SYMMETRIC_OCT_PEM } from "../../../fixtures/oct-keys.fixture";
import { getOctPem } from "./get-oct-pem";

describe("getOctPem", () => {
  test("should return OCT pem", () => {
    expect(getOctPem(SYMMETRIC_OCT_PEM)).toBe(SYMMETRIC_OCT_PEM);
  });

  test("should return OCT jwk", () => {
    expect(getOctPem(SYMMETRIC_OCT_JWK)).toStrictEqual(expect.objectContaining(SYMMETRIC_OCT_PEM));
  });
});

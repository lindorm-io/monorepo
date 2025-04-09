import { Dict } from "@lindorm/types";
import { decodeCoseClaims, mapCoseClaims } from "./claims";

describe("mapCoseClaims", () => {
  let claims: Dict;

  beforeEach(() => {
    claims = {
      aud: ["audience"],
      exp: 1234567890,
      iat: 1234567890,
      iss: "issuer",
      jti: "29569bc5-64a1-5bb6-9c2a-bd17814702aa",
      nbf: 1234567890,
      sub: "cd7eacb1-a3a4-5943-bffc-d163f1949a5d",

      acr: "acr",
      amr: ["amr1", "amr2"],
      at_hash: "at_hash",
      auth_time: 1234567890,
      azp: "azp",
      c_hash: "c_hash",
      nonce: "nonce",
      s_hash: "s_hash",

      aal: 3,
      afr: "afr1",
      cid: "4f325774-db23-5eb5-9a1f-60a82ca42c2b",
      gty: "grant_type",
      loa: 2,
      per: ["permission1", "permission2"],
      rls: ["role1", "role2"],
      scope: ["scope1", "scope2"],
      sid: "60991f15-6ddf-5e0c-8b95-bebf3bca9724",
      sih: "session_hint",
      suh: "subject_hint",
      tid: "097a9cf0-b70c-58ce-b97e-b7359daacc17",
      token_type: "token_type",
    };
  });

  test("should map COSE claims", () => {
    expect(mapCoseClaims(claims as any)).toMatchSnapshot();
  });

  test("should decode mapped COSE claims", () => {
    expect(decodeCoseClaims(mapCoseClaims(claims as any))).toEqual(claims);
  });
});

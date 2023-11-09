import { PKCEMethod } from "@lindorm-io/common-enums";
import { createBaseHash as _createBaseHash } from "./create-base-hash";
import { createPKCE } from "./create-pkce";
import { randomBaseString as _randomBaseString } from "./random-base-string";

jest.mock("./random-base-string");
jest.mock("./create-base-hash");

const createBaseHash = _createBaseHash as jest.Mock;
const randomBaseString = _randomBaseString as jest.Mock;

describe("createPKCE", () => {
  beforeEach(() => {
    createBaseHash.mockImplementation(() => "createBaseHash");
    randomBaseString.mockImplementation(() => "randomBaseString");
  });

  test("should resolve S256", () => {
    expect(createPKCE(PKCEMethod.SHA256)).toStrictEqual({
      challenge: "createBaseHash",
      method: "S256",
      verifier: "randomBaseString",
    });
  });

  test("should resolve plain", () => {
    expect(createPKCE(PKCEMethod.PLAIN)).toStrictEqual({
      challenge: "randomBaseString",
      method: "plain",
      verifier: "randomBaseString",
    });
  });
});

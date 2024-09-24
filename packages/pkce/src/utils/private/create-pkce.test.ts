import { PkceMethod } from "@lindorm/enums";
import { createBaseHash as _createBaseHash } from "./create-base-hash";
import { createPkce } from "./create-pkce";
import { randomBaseString as _randomBaseString } from "./random-base-string";

jest.mock("./random-base-string");
jest.mock("./create-base-hash");

const createBaseHash = _createBaseHash as jest.Mock;
const randomBaseString = _randomBaseString as jest.Mock;

describe("createPkce", () => {
  beforeEach(() => {
    createBaseHash.mockImplementation(() => "createBaseHash");
    randomBaseString.mockImplementation(() => "randomBaseString");
  });

  test("should resolve S256", () => {
    expect(createPkce(PkceMethod.S256, 43)).toStrictEqual({
      challenge: "createBaseHash",
      method: "S256",
      verifier: "randomBaseString",
    });
  });

  test("should resolve plain", () => {
    expect(createPkce(PkceMethod.Plain, 43)).toStrictEqual({
      challenge: "randomBaseString",
      method: "plain",
      verifier: "randomBaseString",
    });
  });
});

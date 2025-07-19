import { PkceMethod } from "@lindorm/types";
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
    expect(createPkce("S256", 43)).toEqual({
      challenge: "createBaseHash",
      method: "S256",
      verifier: "randomBaseString",
    });
  });

  test("should resolve plain", () => {
    expect(createPkce("plain", 43)).toEqual({
      challenge: "randomBaseString",
      method: "plain",
      verifier: "randomBaseString",
    });
  });
});

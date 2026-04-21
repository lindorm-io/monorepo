import type { PkceMethod } from "@lindorm/types";
import { createBaseHash as _createBaseHash } from "./create-base-hash.js";
import { createPkce } from "./create-pkce.js";
import { randomBaseString as _randomBaseString } from "./random-base-string.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("./random-base-string.js");
vi.mock("./create-base-hash.js");

const createBaseHash = _createBaseHash as Mock;
const randomBaseString = _randomBaseString as Mock;

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

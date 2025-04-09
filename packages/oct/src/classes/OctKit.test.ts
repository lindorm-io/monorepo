import { randomBytes } from "crypto";
import { TEST_OCT_KEY_HS256 } from "../__fixtures__/keys";
import { OctError } from "../errors";
import { OctKit } from "./OctKit";

describe("OctKit", () => {
  let kit: OctKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new OctKit({ kryptos: TEST_OCT_KEY_HS256 });
    data = randomBytes(32);
    signature = kit.sign(data);
  });

  test("should verify", () => {
    expect(kit.verify(data, signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert(data, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(OctError);
  });
});

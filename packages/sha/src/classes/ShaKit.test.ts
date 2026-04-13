import { ShaError } from "../errors";
import { ShaKit } from "./ShaKit";

describe("ShaKit", () => {
  let kit: ShaKit;
  let hash: string;

  beforeEach(() => {
    kit = new ShaKit();
    hash = kit.hash("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", hash)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", hash)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", hash)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", hash)).toThrow(ShaError);
  });

  describe("static hashes", () => {
    const buffer = Buffer.from("data", "utf8");

    test("should hash Buffer input with S1", () => {
      expect(ShaKit.S1(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S256", () => {
      expect(ShaKit.S256(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S384", () => {
      expect(ShaKit.S384(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S512", () => {
      expect(ShaKit.S512(buffer)).toMatchSnapshot();
    });

    test("should produce identical output for equivalent string and Buffer inputs", () => {
      expect(ShaKit.S1(buffer)).toEqual(ShaKit.S1("data"));
      expect(ShaKit.S256(buffer)).toEqual(ShaKit.S256("data"));
      expect(ShaKit.S384(buffer)).toEqual(ShaKit.S384("data"));
      expect(ShaKit.S512(buffer)).toEqual(ShaKit.S512("data"));
    });
  });
});

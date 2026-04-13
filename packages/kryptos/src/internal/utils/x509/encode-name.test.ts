import { encodeX509Name } from "./encode-name";

describe("encodeX509Name", () => {
  test("encodes CN only", () => {
    expect(
      encodeX509Name({ commonName: "example.test" }).toString("hex"),
    ).toMatchSnapshot();
  });

  test("encodes organization + CN", () => {
    expect(
      encodeX509Name({ commonName: "example.test", organization: "Lindorm" }).toString(
        "hex",
      ),
    ).toMatchSnapshot();
  });

  test("encodes non-ASCII UTF-8 CN", () => {
    expect(encodeX509Name({ commonName: "Ölåñd" }).toString("hex")).toMatchSnapshot();
  });

  test("passes raw bytes through unchanged", () => {
    const raw = Buffer.from("3014311230100603550403130965786576616d706c65", "hex");
    const out = encodeX509Name({ raw });
    expect(out.equals(raw)).toBe(true);
  });
});

import { encodeX509Name } from "./encode-name.js";
import { parseX509Name } from "./parse-name.js";
import { describe, expect, test } from "vitest";

describe("parseX509Name", () => {
  test("round-trips a CN-only name", () => {
    const der = encodeX509Name({ commonName: "lindorm-test" });
    const parsed = parseX509Name(der);
    expect(parsed.commonName).toBe("lindorm-test");
    expect(parsed.organization).toBeUndefined();
    expect(parsed.raw.equals(der)).toBe(true);
  });

  test("round-trips a CN + O name", () => {
    const der = encodeX509Name({ commonName: "leaf", organization: "lindorm" });
    const parsed = parseX509Name(der);
    expect(parsed.commonName).toBe("leaf");
    expect(parsed.organization).toBe("lindorm");
  });
});

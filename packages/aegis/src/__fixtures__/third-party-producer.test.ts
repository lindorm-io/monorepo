import { describe, expect, test } from "vitest";
import { inspectToken } from "./inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "./keys.js";
import {
  sealAsThirdParty,
  signAsThirdParty,
  type ForeignHeaders,
} from "./third-party-producer.js";

const COSE_ONLY: Array<[name: string, headers: ForeignHeaders, refusal: RegExp]> = [
  [
    "an unprotected header, since a compact serialisation has no unprotected bucket",
    { unprotectedHeader: { cty: "application/json" } },
    /no unprotected bucket/,
  ],
  [
    "unprotected entries at integer labels, since a compact serialisation has no unprotected bucket",
    { integerLabelledUnprotected: new Map([[-70000, "1.2.3.4"]]) },
    /no unprotected bucket/,
  ],
  [
    "protected entries under text labels, since a JOSE header has no second label form",
    { textLabelledProtected: { crit: ["oid"] } },
    /no second label form/,
  ],
  [
    "protected entries at integer labels, since a JOSE header has no second label form",
    { integerLabelledProtected: new Map([[-70000, "1.2.3.4"]]) },
    /no second label form/,
  ],
  [
    "a key id placement, since a compact serialisation has one header for the key id to ride",
    { kidPlacement: "protected" },
    /no bucket for a producer to place it in/,
  ],
];

describe("sealAsThirdParty on the jose wire", () => {
  test.each(COSE_ONLY)("refuses %s", async (_name, headers, refusal) => {
    await expect(
      sealAsThirdParty(
        "jose",
        Buffer.from("sealed"),
        undefined,
        TEST_OCT_KEY_ENC,
        headers,
      ),
    ).rejects.toThrow(refusal);
  });

  test("writes a stated protected header beside the parameters it derives from its key", async () => {
    const token = await sealAsThirdParty(
      "jose",
      Buffer.from("sealed"),
      undefined,
      TEST_OCT_KEY_ENC,
      { protectedHeader: { cty: "application/json" } },
    );

    expect(inspectToken(token).protectedHeader).toMatchSnapshot();
  });
});

describe("signAsThirdParty on the jose wire", () => {
  test.each(COSE_ONLY)("refuses %s", async (_name, headers, refusal) => {
    await expect(
      signAsThirdParty("jose", { sub: "user-1" }, undefined, TEST_EC_KEY_SIG, headers),
    ).rejects.toThrow(refusal);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { documentTitle } from "./document-title.js";

const read = (name: string): string =>
  readFileSync(new URL(`./__mini__/${name}`, import.meta.url), "utf8");

describe("documentTitle", () => {
  test("should read the centred block above the abstract", () => {
    expect(documentTitle("rfc", read("mini-rfc.txt"))).toEqual("A Mini Fixture Document");
  });

  test("should read the same title out of the unpaginated format", () => {
    expect(documentTitle("rfc", read("mini-rfc-v3.txt"))).toEqual(
      "A Mini Fixture Document",
    );
  });

  // The errata set is part of what was fetched, so it stays in the title.
  test("should read an html title across line breaks", () => {
    expect(documentTitle("oidc", read("mini-oidc.html"))).toEqual(
      "Final: Mini OpenID Fixture 1.0 incorporating errata set 1",
    );
  });
});

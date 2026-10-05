import { describe, expect, test } from "vitest";
import { SYNTHETIC_SPEC } from "../../__fixtures__/synthetic-spec.js";
import { CoseError } from "../../errors/index.js";
import { CNF_MEMBERS } from "../claims/cnf-members.js";
import type { ClaimMemberSpec, ObjectCodec } from "../registry/claim-spec.js";
import { wireAbsent, wireLabel, wireName } from "../registry/wire-key.js";
import { registeredLabelsOf } from "./registered-labels.js";

/**
 * The registered label table's CONSTRUCTION GUARDS, each on a synthetic member:
 * no registered structure the registry declares exercises one, so a declaration
 * that would be refused at import is driven here.
 */
const member = (
  domain: string,
  cose: ClaimMemberSpec["wire"]["cose"],
  codec: ClaimMemberSpec["codec"],
): ClaimMemberSpec => ({
  domain,
  spec: SYNTHETIC_SPEC,
  wire: { jose: wireName(domain), cose },
  codec,
  whenEmpty: "keep",
  sample: "sample",
});

const refusalOf = (act: () => unknown): { code: unknown; data: unknown } => {
  try {
    act();
  } catch (error) {
    return { code: (error as CoseError).code, data: (error as CoseError).data };
  }

  throw new Error("the call was expected to refuse and did not");
};

describe("registeredLabelsOf", () => {
  test("derives the confirmation's table: label 1 a COSE_Key, label 3 a UTF-8 byte string", () => {
    expect(registeredLabelsOf("confirmation", CNF_MEMBERS)).toEqual([
      { name: "jwk", label: 1, codec: { kind: "coseKey" } },
      { name: "kid", label: 3, codec: { kind: "bstr", encoding: "utf8" } },
    ]);
  });

  test("gives a member absent on COSE no entry", () => {
    expect(
      registeredLabelsOf("synthetic", [
        member("thumbprint", wireAbsent("A synthetic member with no COSE form."), {
          kind: "text",
        }),
        member("keyId", wireLabel(3, "kid"), {
          kind: "text",
          per: { cose: { kind: "bstr", encoding: "utf8" } },
        }),
      ]),
    ).toEqual([{ name: "kid", label: 3, codec: { kind: "bstr", encoding: "utf8" } }]);
  });

  test("refuses a member keyed by a text name on COSE", () => {
    expect(
      refusalOf(() =>
        registeredLabelsOf("synthetic", [
          member("acr", wireName("acr"), { kind: "text" }),
        ]),
      ),
    ).toEqual({
      code: "cose_registered_member_unsupported",
      data: { claim: "synthetic", member: "acr" },
    });
  });

  test.each([
    ["text with no per-wire codec", { kind: "text" } as const],
    ["a base64url byte string", { kind: "bstr", encoding: "b64u" } as const],
    ["an integer", { kind: "int" } as const],
    [
      "a nested structure",
      {
        kind: "object",
        children: () => [],
        open: "verbatim",
        readLeafFailure: "drop",
        binds: "none",
        labels: "proprietary",
      } as ObjectCodec,
    ],
  ])("refuses a labelled member whose COSE codec is %s", (_name, codec) => {
    expect(
      refusalOf(() =>
        registeredLabelsOf("synthetic", [member("sub", wireLabel(2, "sub"), codec)]),
      ),
    ).toEqual({
      code: "cose_registered_member_unsupported",
      data: { claim: "synthetic", member: "sub" },
    });
  });

  test("reads the COSE codec through the per-wire override, so a text member with a byte-string COSE form is carried", () => {
    expect(
      registeredLabelsOf("synthetic", [
        member("sub", wireLabel(2, "sub"), {
          kind: "text",
          per: { cose: { kind: "bstr", encoding: "utf8" } },
        }),
      ]),
    ).toEqual([{ name: "sub", label: 2, codec: { kind: "bstr", encoding: "utf8" } }]);
  });
});

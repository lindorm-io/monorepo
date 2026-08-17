import { describe, expect, test } from "vitest";
import { subIdShape } from "./sub-id-shape.js";

describe("subIdShape", () => {
  test("passes when sub_id is absent", () => {
    expect(subIdShape({})).toEqual([]);
  });

  test("passes for a valid iss_sub format", () => {
    expect(
      subIdShape({ subjectId: { format: "iss_sub", iss: "https://x", sub: "s" } }),
    ).toEqual([]);
  });

  test("passes for an unknown format with only format", () => {
    expect(subIdShape({ subjectId: { format: "custom_format" } })).toEqual([]);
  });

  test("fails when sub_id is not an object", () => {
    expect(subIdShape({ subjectId: "x" })).toMatchSnapshot();
  });

  test("fails when format is missing", () => {
    expect(subIdShape({ subjectId: { iss: "x" } })).toMatchSnapshot();
  });

  test("fails when a required member of the format is missing", () => {
    expect(subIdShape({ subjectId: { format: "iss_sub", iss: "x" } })).toMatchSnapshot();
  });

  /**
   * A format's required member is what IDENTIFIES the subject (RFC 9493 §3), so
   * an empty one identifies nobody and cannot satisfy the demand for it. One row
   * per format, because the member name comes from a per-format table and a
   * single row would only prove the one entry it happened to pick.
   *
   * ⚠ Live on `security_event`, which requires `subjectId` and FORBIDS `subject`
   * — `sub_id` is the only thing naming the subject of the event there, so a
   * security event token identifying nobody used to mint and verify clean.
   */
  test.each([
    ["account", { format: "account", uri: "" }],
    ["aliases", { format: "aliases", identifiers: [] }],
    ["did", { format: "did", url: "" }],
    ["email", { format: "email", email: "" }],
    ["iss_sub", { format: "iss_sub", iss: "https://x", sub: "" }],
    ["opaque", { format: "opaque", id: "" }],
    ["phone_number", { format: "phone_number", phone_number: "" }],
    ["uri", { format: "uri", uri: "" }],
  ])("fails when the %s format's required member is empty", (_format, subjectId) => {
    expect(subIdShape({ subjectId })).toMatchSnapshot();
  });

  // `null` reaches a verifier from any JSON token, and the predicate this
  // replaced already refused it at the top level — a member read had been weaker
  // than the claim read it sits inside.
  test("fails when a required member is null", () => {
    expect(subIdShape({ subjectId: { format: "opaque", id: null } })).toMatchSnapshot();
  });
});

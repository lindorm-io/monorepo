import { CHANGE_CASE_MODES, type ChangeCase } from "../../types/index.js";
import { isVerbatimKey } from "../is-verbatim-key.js";
import { changeKeys } from "./change-keys.js";
import { describe, expect, test, vi } from "vitest";

const CONVERTING_MODES: Array<Exclude<ChangeCase, "none">> = CHANGE_CASE_MODES.filter(
  (mode): mode is Exclude<ChangeCase, "none"> => mode !== "none",
);

describe("changeKeys exempt", () => {
  test("should keep an exempt key verbatim", () => {
    expect(
      changeKeys({ "x5t#S256": "t", keyId: "k" }, "snake", { exempt: isVerbatimKey }),
    ).toEqual({ "x5t#S256": "t", key_id: "k" });
  });

  test("should keep an exempt key verbatim in camel mode", () => {
    expect(
      changeKeys({ "x5t#S256": "t", grant_type: "g" }, "camel", {
        exempt: isVerbatimKey,
      }),
    ).toEqual({ "x5t#S256": "t", grantType: "g" });
  });

  test("should keep an exempt key's value by reference", () => {
    const input = { "https://claims.lindorm.io/tenant": { tenantId: 1 } };

    const result = changeKeys(input, "snake", { exempt: isVerbatimKey });

    expect(result["https://claims.lindorm.io/tenant"]).toBe(
      input["https://claims.lindorm.io/tenant"],
    );
    expect(result["https://claims.lindorm.io/tenant"]).toEqual({ tenantId: 1 });
  });

  test("should keep an exempt key's array value by reference", () => {
    const input = { "a.b": [{ innerKey: 1 }] };

    const result = changeKeys(input, "snake", { exempt: isVerbatimKey });

    expect(result["a.b"]).toBe(input["a.b"]);
  });

  test("should convert the siblings of an exempt key", () => {
    expect(
      changeKeys({ "a.b": 1, siblingKey: 2, otherSibling: 3 }, "snake", {
        exempt: isVerbatimKey,
      }),
    ).toEqual({ "a.b": 1, sibling_key: 2, other_sibling: 3 });
  });

  test("should apply the exemption at every depth", () => {
    expect(
      changeKeys(
        {
          tokenClaims: {
            "https://claims.lindorm.io/tenant": { tenantId: 1 },
            issuedAt: 1,
          },
        },
        "snake",
        { exempt: isVerbatimKey },
      ),
    ).toEqual({
      token_claims: { "https://claims.lindorm.io/tenant": { tenantId: 1 }, issued_at: 1 },
    });
  });

  test("should apply the exemption inside an array of objects", () => {
    expect(
      changeKeys([{ "x5t#S256": "a", keyId: "k" }, { keyId: "j" }], "snake", {
        exempt: isVerbatimKey,
      }),
    ).toEqual([{ "x5t#S256": "a", key_id: "k" }, { key_id: "j" }]);
  });

  test("should not spend depth on an exempt key", () => {
    const input = { "a.b": { innerKey: 1 }, outerKey: { innerKey: 1 } };

    const result = changeKeys(input, "snake", { depth: 1, exempt: isVerbatimKey });

    expect(result).toEqual({ "a.b": { innerKey: 1 }, outer_key: { innerKey: 1 } });
    expect(result["a.b"]).toBe(input["a.b"]);
  });

  test("should convert a verbatim-class key when exempt is omitted", () => {
    expect(changeKeys({ "x5t#S256": 1 }, "snake")).toEqual({ x5t_s256: 1 });
  });

  test("should return the input by reference for mode none", () => {
    const input = { "x5t#S256": "t", keyId: "k" };

    expect(changeKeys(input, "none", { exempt: isVerbatimKey })).toBe(input);
  });

  test("should not mutate the input", () => {
    const input = {
      tokenClaims: { "https://claims.lindorm.io/tenant": { tenantId: 1 }, issuedAt: 1 },
    };
    const clone = structuredClone(input);

    changeKeys(input, "snake", { exempt: isVerbatimKey });

    expect(input).toEqual(clone);
  });

  test("should exempt with a caller-supplied predicate", () => {
    expect(
      changeKeys({ keepMe: 1, dropMe: 2 }, "snake", {
        exempt: (key) => key === "keepMe",
      }),
    ).toEqual({ keepMe: 1, drop_me: 2 });
  });

  test("should apply the exemption inside an array under a converted key", () => {
    expect(
      changeKeys({ keys: [{ "x5t#S256": "t", keyId: "k" }] }, "snake", {
        exempt: isVerbatimKey,
      }),
    ).toEqual({ keys: [{ "x5t#S256": "t", key_id: "k" }] });
  });

  test("should apply the exemption inside nested arrays", () => {
    expect(
      changeKeys({ outerKey: [[{ "x5t#S256": "t", innerKey: 1 }]] }, "snake", {
        exempt: isVerbatimKey,
      }),
    ).toEqual({ outer_key: [[{ "x5t#S256": "t", inner_key: 1 }]] });
  });

  test("should keep an exempt key with a null value", () => {
    const result = changeKeys({ "a.b": null, keyId: 1 }, "snake", {
      exempt: isVerbatimKey,
    });

    expect(result).toEqual({ "a.b": null, key_id: 1 });
    expect(result["a.b"]).toBeNull();
  });

  test("should keep an exempt key with an undefined value", () => {
    const result = changeKeys({ "a.b": undefined, keyId: 1 }, "snake", {
      exempt: isVerbatimKey,
    });

    expect(Object.keys(result)).toEqual(["a.b", "key_id"]);
    expect(result["a.b"]).toBeUndefined();
  });

  test("should not spend depth on an exempt key below the top level", () => {
    const input = { outerKey: { "a.b": { innerKey: 1 }, middleKey: { innerKey: 1 } } };

    const result = changeKeys(input, "snake", { depth: 2, exempt: isVerbatimKey }) as any;

    expect(result).toEqual({
      outer_key: { "a.b": { innerKey: 1 }, middle_key: { innerKey: 1 } },
    });
    expect(result.outer_key["a.b"]).toBe(input.outerKey["a.b"]);
  });

  test("should not consult exempt for an out-of-depth subtree", () => {
    const exempt = vi.fn(isVerbatimKey);
    const input = { outerKey: { "a.b": 1, innerKey: 1 } };

    const result = changeKeys(input, "snake", { depth: 1, exempt }) as any;

    expect(result).toEqual({ outer_key: { "a.b": 1, innerKey: 1 } });
    expect(result.outer_key).toBe(input.outerKey);
    expect(exempt.mock.calls).toEqual([["outerKey"]]);
  });

  test("should consult exempt exactly once per walked key", () => {
    const exempt = vi.fn(isVerbatimKey);

    changeKeys(
      { "a.b": { innerKey: 1 }, outerKey: { innerKey: 1 }, list: [{ itemKey: 1 }] },
      "snake",
      { exempt },
    );

    expect(exempt.mock.calls.map(([key]) => key).sort()).toEqual([
      "a.b",
      "innerKey",
      "itemKey",
      "list",
      "outerKey",
    ]);
  });

  test.each(CONVERTING_MODES)("should forward exempt in %s mode", (mode) => {
    const value = { innerKey: 1 };

    const result = changeKeys({ "x5t#S256": value, keyId: "k" }, mode, {
      exempt: isVerbatimKey,
    });

    expect(result["x5t#S256"]).toBe(value);
  });
});

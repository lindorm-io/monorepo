import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import type { MetaField } from "../types/metadata.js";
import {
  dehydrateTypedJson,
  hydrateTypedJson,
  joinTypedJson,
  splitTypedJson,
  typedJsonChangedColumns,
  typedJsonMetaDictKey,
} from "./typed-json.js";

const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: "https://test.proteus.typedjson/",
  purpose: "proteus:typed-json-test",
});

const amphora = new Amphora({ logger: createMockLogger() });
amphora.add([KEK]);

const CONDITION = { purpose: "proteus:typed-json-test" };

const makeField = (overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key: "payload",
    name: "payload",
    type: "json",
    encrypted: null,
    transform: null,
    typedJson: { name: null, column: "payload__typemeta" },
    ...overrides,
  }) as unknown as MetaField;

const PAYLOAD = () => ({
  when: new Date("2021-06-15T10:30:00.000Z"),
  blob: Buffer.from("hello"),
  big: 9007199254740993n,
  maybe: undefined,
  plain: "text",
});

const expectPayloadIntact = (value: unknown) => {
  const p = value as any;
  expect(p.when).toBeInstanceOf(Date);
  expect((p.when as Date).getTime()).toBe(new Date("2021-06-15T10:30:00.000Z").getTime());
  expect(Buffer.isBuffer(p.blob)).toBe(true);
  expect((p.blob as Buffer).toString()).toBe("hello");
  expect(typeof p.big).toBe("bigint");
  expect(p.big).toBe(9007199254740993n);
  expect("maybe" in p).toBe(true);
  expect(p.maybe).toBeUndefined();
  expect(p.plain).toBe("text");
};

describe("dehydrateTypedJson / hydrateTypedJson", () => {
  test("splits an unencrypted value and rejoins it losslessly", () => {
    const field = makeField();

    const { data, meta } = dehydrateTypedJson(field, PAYLOAD(), undefined, "Test");

    expect(data).toMatchSnapshot();
    expect(meta).toMatchSnapshot();

    expectPayloadIntact(hydrateTypedJson(field, data, meta, undefined, "Test"));
  });

  test("seals BOTH halves when the field is @Encrypted", () => {
    const field = makeField({
      encrypted: { kryptos: null, condition: CONDITION } as any,
    });

    const { data, meta } = dehydrateTypedJson(field, PAYLOAD(), amphora, "Test");

    // Each half is independent ciphertext — neither the values nor the type map
    // survives in the clear.
    expect(typeof data).toBe("string");
    expect(typeof meta).toBe("string");
    expect(data).not.toContain("hello");
    expect(data).not.toContain("2021-06-15");
    expect(data).not.toContain("9007199254740993");
    expect(meta).not.toContain('"plain":"S"');

    expectPayloadIntact(hydrateTypedJson(field, data, meta, amphora, "Test"));
  });

  test("sealing the joined value first is what the split-first order avoids", () => {
    // The old order handed AesKit the live value. AesKit JSON-stringifies its
    // content, so a nested BigInt throws outright — this is the failure the
    // split-first order removes, pinned here so the order cannot be reverted
    // silently.
    expect(() => JSON.stringify(PAYLOAD())).toThrow(TypeError);

    // After the split the data half is JSON-safe, so it serialises fine.
    expect(() => JSON.stringify(splitTypedJson(PAYLOAD()).data)).not.toThrow();
  });

  test("applies transform.to before the split and transform.from after the join", () => {
    // Non-idempotent: a dropped `to` reads one too low, a doubled one too high.
    const field = makeField({
      transform: {
        to: (value: any) => ({ ...value, tick: value.tick + 1 }),
        from: (raw: any) => ({ ...raw, tick: raw.tick - 1 }),
      } as any,
    });

    const { data, meta } = dehydrateTypedJson(
      field,
      { tick: 5, at: new Date("2020-01-01T00:00:00.000Z") },
      undefined,
      "Test",
    );

    // The stored half carries the INCREMENTED value — proof `to` ran before the
    // split. (JsonKit writes a number as its string form in the data half; the
    // sidecar restores the type on the way back.)
    expect(String((data as any).tick)).toBe("6");

    const value = hydrateTypedJson(field, data, meta, undefined, "Test") as any;
    expect(value.tick).toBe(5);
    expect(value.at).toBeInstanceOf(Date);
  });

  test("carries null on both halves for a null value, sealing nothing", () => {
    const field = makeField({
      encrypted: { kryptos: null, condition: CONDITION } as any,
    });

    expect(dehydrateTypedJson(field, null, amphora, "Test")).toEqual({
      data: null,
      meta: null,
    });
    expect(hydrateTypedJson(field, null, null, amphora, "Test")).toBeNull();
  });

  test("a scalar payload carries no sidecar and still seals its data half", () => {
    const field = makeField({
      encrypted: { kryptos: null, condition: CONDITION } as any,
    });

    const { data, meta } = dehydrateTypedJson(field, "just-a-string", amphora, "Test");

    expect(meta).toBeNull();
    expect(data).not.toBe("just-a-string");
    expect(hydrateTypedJson(field, data, meta, amphora, "Test")).toBe("just-a-string");
  });

  test("a missing sidecar degrades to the plain sealed data rather than throwing", () => {
    const field = makeField({
      encrypted: { kryptos: null, condition: CONDITION } as any,
    });

    const { data } = dehydrateTypedJson(field, PAYLOAD(), amphora, "Test");

    // Sidecar lost (stale row, failed write): the data column is authoritative,
    // so the read still returns the JSON-safe values instead of failing.
    const value = hydrateTypedJson(field, data, null, amphora, "Test") as any;
    expect(value.plain).toBe("text");
    expect(value.when).toBe("2021-06-15T10:30:00.000Z");
  });
});

describe("typedJsonChangedColumns", () => {
  test("expands to the data column and its sidecar, coercing only the data half", () => {
    const field = makeField();

    const columns = typedJsonChangedColumns(
      field,
      PAYLOAD(),
      (data) => JSON.stringify(data),
      undefined,
      "Test",
    );

    expect(columns).toHaveLength(2);
    expect(columns[0].column).toBe("payload");
    expect(columns[1].column).toBe("payload__typemeta");
    expect(columns).toMatchSnapshot();
  });

  test("seals both columns when the field is @Encrypted", () => {
    const field = makeField({
      encrypted: { kryptos: null, condition: CONDITION } as any,
    });

    const columns = typedJsonChangedColumns(
      field,
      PAYLOAD(),
      (data) => data,
      amphora,
      "Test",
    );

    expect(String(columns[0].value)).not.toContain("hello");
    expect(String(columns[1].value)).not.toContain('"plain":"S"');
  });
});

describe("typedJsonMetaDictKey / joinTypedJson", () => {
  test("the dict key is namespaced so it cannot collide with a field key", () => {
    expect(typedJsonMetaDictKey("payload")).toMatchSnapshot();
  });

  test("a corrupt sidecar falls back to the plain data instead of throwing", () => {
    expect(joinTypedJson('{"a":1}', "not-json-at-all")).toEqual({ a: 1 });
  });
});

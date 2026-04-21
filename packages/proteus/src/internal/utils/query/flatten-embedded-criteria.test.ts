import type { EntityMetadata } from "../../entity/types/metadata.js";
import { makeField } from "../../__fixtures__/make-field.js";
import { flattenEmbeddedCriteria } from "./flatten-embedded-criteria.js";
import { describe, expect, test } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeEmbeddedMetadata = (): EntityMetadata =>
  ({
    fields: [
      makeField("id"),
      makeField("name"),
      makeField("address.street", {
        embedded: { parentKey: "address", constructor: () => Object },
      }),
      makeField("address.city", {
        embedded: { parentKey: "address", constructor: () => Object },
      }),
      makeField("address.country", {
        embedded: { parentKey: "address", constructor: () => Object },
      }),
    ],
  }) as unknown as EntityMetadata;

// ── Tests ────────────────────────────────────────────────────────────────────

describe("flattenEmbeddedCriteria", () => {
  const metadata = makeEmbeddedMetadata();

  test("should flatten simple embedded equality", () => {
    const result = flattenEmbeddedCriteria(
      { address: { city: "London" } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should flatten multiple embedded fields", () => {
    const result = flattenEmbeddedCriteria(
      { address: { city: "London", country: "UK" } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should preserve operator inside embedded child value", () => {
    const result = flattenEmbeddedCriteria(
      { address: { city: { $like: "Lon%" } } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should handle $or with embedded criteria", () => {
    const result = flattenEmbeddedCriteria(
      { $or: [{ address: { city: "London" } }, { address: { city: "Paris" } }] } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should handle $not with embedded criteria", () => {
    const result = flattenEmbeddedCriteria(
      { $not: { address: { city: "London" } } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should pass through non-embedded keys unchanged", () => {
    const result = flattenEmbeddedCriteria({ name: "Alice" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should handle mixed embedded and non-embedded keys", () => {
    const result = flattenEmbeddedCriteria(
      { name: "Alice", address: { city: "London" } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should not flatten null embedded value", () => {
    const result = flattenEmbeddedCriteria({ address: null } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should handle $and with embedded criteria", () => {
    const result = flattenEmbeddedCriteria(
      {
        $and: [{ address: { city: "London" } }, { address: { country: "UK" } }],
      } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should not flatten array value for embedded parent key", () => {
    const result = flattenEmbeddedCriteria({ address: ["London"] } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should not flatten predicate operator on embedded parent key", () => {
    // When the value has a $-prefixed operator key (not a logical one),
    // it should be passed through as-is, not flattened
    const result = flattenEmbeddedCriteria(
      { address: { $eq: "something" } } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });
});

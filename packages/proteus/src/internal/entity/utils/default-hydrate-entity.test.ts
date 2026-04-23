import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { defaultHydrateEntity } from "./default-hydrate-entity.js";
import { getSnapshot } from "./snapshot-store.js";
import { describe, expect, test, vi } from "vitest";

// ─── Embedded Fixtures ──────────────────────────────────────────────────────

class EmbeddedCity {
  name: string = "";
  zip: string | null = null;
}

class EmbeddedPersonEntity {
  id: string = "";
  "address.city": string = "";
  "address.zip": string | null = null;
  address: EmbeddedCity | null = null;
}

class TestEntity {
  id: string = "";
  name: string = "";
  age: number = 0;
  score: bigint = BigInt(0);
  deletedAt: Date | null = null;
}

const metadata = {
  target: TestEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("age", { type: "integer" }),
    makeField("score", { type: "bigint" }),
    makeField("deletedAt", { type: "timestamp", name: "deleted_at", nullable: true }),
  ],
  relations: [],
  primaryKeys: ["id"],
  hooks: [],
} as unknown as EntityMetadata;

describe("defaultHydrateEntity", () => {
  test("should create entity instance from target constructor", () => {
    const result = defaultHydrateEntity({ id: "abc" }, metadata, { snapshot: false });
    expect(result).toBeInstanceOf(TestEntity);
  });

  test("should assign field values from data dict", () => {
    const result = defaultHydrateEntity({ id: "abc", name: "Alice", age: 30 }, metadata, {
      snapshot: false,
    });
    expect(result).toMatchSnapshot();
  });

  test("should skip absent fields", () => {
    const result = defaultHydrateEntity({ id: "abc" }, metadata, { snapshot: false });
    // name/age keep class defaults since they're not in data
    expect((result as any).name).toBe("");
    expect((result as any).age).toBe(0);
  });

  test("should preserve null values as-is", () => {
    const result = defaultHydrateEntity(
      { id: "abc", name: null, deletedAt: null },
      metadata,
      { snapshot: false },
    );
    expect((result as any).name).toBeNull();
    expect((result as any).deletedAt).toBeNull();
  });

  test("should deserialise non-null values", () => {
    const result = defaultHydrateEntity(
      { id: "abc", age: "42", score: "9007199254740993" },
      metadata,
      { snapshot: false },
    );
    expect((result as any).age).toBe(42);
    expect((result as any).score).toBe(BigInt("9007199254740993"));
  });

  test("should store snapshot by default", () => {
    const result = defaultHydrateEntity({ id: "abc", name: "Alice" }, metadata);
    const snap = getSnapshot(result);
    expect(snap).not.toBeNull();
    expect(snap!.id).toBe("abc");
    expect(snap!.name).toBe("Alice");
  });

  test("should skip snapshot when option is false", () => {
    const result = defaultHydrateEntity({ id: "abc" }, metadata, { snapshot: false });
    expect(getSnapshot(result)).toBeNull();
  });

  test("should fire OnHydrate hooks by default", () => {
    const hookCb = vi.fn();
    const metaWithHooks = {
      ...metadata,
      hooks: [{ decorator: "OnHydrate", callback: hookCb }],
    } as unknown as EntityMetadata;

    const result = defaultHydrateEntity({ id: "abc" }, metaWithHooks, {
      snapshot: false,
    });

    expect(hookCb).toHaveBeenCalledWith(
      result,
      expect.objectContaining({
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      }),
    );
  });

  test("should skip hooks when option is false", () => {
    const hookCb = vi.fn();
    const metaWithHooks = {
      ...metadata,
      hooks: [{ decorator: "OnHydrate", callback: hookCb }],
    } as unknown as EntityMetadata;

    defaultHydrateEntity({ id: "abc" }, metaWithHooks, { snapshot: false, hooks: false });

    expect(hookCb).not.toHaveBeenCalled();
  });

  test("should pass entity and meta to hooks in that order", () => {
    const hookCb = vi.fn();
    const metaWithHooks = {
      ...metadata,
      hooks: [{ decorator: "OnHydrate", callback: hookCb }],
    } as unknown as EntityMetadata;
    const hookMeta = {
      correlationId: "c-1",
      actor: "admin",
      timestamp: new Date("2024-01-01T00:00:00Z"),
    };

    defaultHydrateEntity({ id: "abc" }, metaWithHooks, {
      snapshot: false,
      meta: hookMeta,
    });

    expect(hookCb).toHaveBeenCalledWith(expect.any(TestEntity), hookMeta);
  });

  test("should extract FK columns from owning relations", () => {
    const metaWithRelation = {
      ...metadata,
      relations: [
        {
          key: "author",
          type: "ManyToOne",
          joinKeys: { authorId: "id" },
          options: { loading: { single: "ignore", multiple: "ignore" } },
        },
      ],
    } as unknown as EntityMetadata;

    const result = defaultHydrateEntity(
      { id: "abc", name: "Post", authorId: "user-1" },
      metaWithRelation,
      { snapshot: false },
    );

    expect((result as any).authorId).toBe("user-1");
  });

  test("should include FK columns in snapshot", () => {
    const metaWithRelation = {
      ...metadata,
      relations: [
        {
          key: "author",
          type: "ManyToOne",
          joinKeys: { authorId: "id" },
          options: { loading: { single: "ignore", multiple: "ignore" } },
        },
      ],
    } as unknown as EntityMetadata;

    const result = defaultHydrateEntity(
      { id: "abc", name: "Post", authorId: "user-1" },
      metaWithRelation,
    );

    const snap = getSnapshot(result);
    expect(snap).not.toBeNull();
    expect(snap!.authorId).toBe("user-1");
  });

  test("should reconstruct embedded object from dotted-key data", () => {
    const metaWithEmbedded = {
      target: EmbeddedPersonEntity,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.city", {
          type: "string",
          name: "address_city",
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
        makeField("address.zip", {
          type: "string",
          name: "address_zip",
          nullable: true,
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
      hooks: [],
    } as unknown as EntityMetadata;

    const data = {
      id: "abc",
      "address.city": "Springfield",
      "address.zip": "62704",
    };

    const entity = defaultHydrateEntity(data, metaWithEmbedded, {
      snapshot: false,
      hooks: false,
    }) as any;

    expect(entity.address).toBeDefined();
    expect(entity.address).toBeInstanceOf(EmbeddedCity);
    expect(entity.address.city).toBe("Springfield");
    expect(entity.address.zip).toBe("62704");
    // Dotted keys must be cleaned up
    expect(entity["address.city"]).toBeUndefined();
    expect(entity["address.zip"]).toBeUndefined();
  });

  test("should set embedded parent key to null when all embedded values are null", () => {
    const metaWithEmbedded = {
      target: EmbeddedPersonEntity,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.city", {
          type: "string",
          name: "address_city",
          nullable: true,
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
        makeField("address.zip", {
          type: "string",
          name: "address_zip",
          nullable: true,
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
      hooks: [],
    } as unknown as EntityMetadata;

    const data = {
      id: "abc",
      "address.city": null,
      "address.zip": null,
    };

    const entity = defaultHydrateEntity(data, metaWithEmbedded, {
      snapshot: false,
      hooks: false,
    }) as any;

    expect(entity.address).toBeNull();
    expect(entity["address.city"]).toBeUndefined();
    expect(entity["address.zip"]).toBeUndefined();
  });

  test("should include embedded parent key in snapshot (not dotted keys)", () => {
    const metaWithEmbedded = {
      target: EmbeddedPersonEntity,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.city", {
          type: "string",
          name: "address_city",
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
        makeField("address.zip", {
          type: "string",
          name: "address_zip",
          nullable: true,
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
      hooks: [],
    } as unknown as EntityMetadata;

    const data = {
      id: "abc",
      "address.city": "Springfield",
      "address.zip": "62704",
    };

    const entity = defaultHydrateEntity(data, metaWithEmbedded) as any;
    const snap = getSnapshot(entity);

    expect(snap).not.toBeNull();
    // Snapshot should have parentKey, not dotted sub-keys
    expect(snap!.address).toBeDefined();
    expect(snap!["address.city"]).toBeUndefined();
    expect(snap!["address.zip"]).toBeUndefined();
  });

  test("should handle mix of null and non-null embedded fields (partial null = reconstructed object)", () => {
    const metaWithEmbedded = {
      target: EmbeddedPersonEntity,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.city", {
          type: "string",
          name: "address_city",
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
        makeField("address.zip", {
          type: "string",
          name: "address_zip",
          nullable: true,
          embedded: { parentKey: "address", constructor: () => EmbeddedCity },
        }),
      ],
      relations: [],
      primaryKeys: ["id"],
      hooks: [],
    } as unknown as EntityMetadata;

    // city is present, zip is null — not all null, so object should be reconstructed
    const data = {
      id: "abc",
      "address.city": "Shelbyville",
      "address.zip": null,
    };

    const entity = defaultHydrateEntity(data, metaWithEmbedded, {
      snapshot: false,
      hooks: false,
    }) as any;

    expect(entity.address).not.toBeNull();
    expect(entity.address).toBeInstanceOf(EmbeddedCity);
    expect(entity.address.city).toBe("Shelbyville");
    expect(entity.address.zip).toBeNull();
  });

  test("should skip ManyToMany relations in FK extraction", () => {
    const metaWithM2M = {
      ...metadata,
      relations: [
        {
          key: "tags",
          type: "ManyToMany",
          joinKeys: { tagId: "id" },
          options: { loading: { single: "ignore", multiple: "ignore" } },
        },
      ],
    } as unknown as EntityMetadata;

    const result = defaultHydrateEntity({ id: "abc", tagId: "tag-1" }, metaWithM2M, {
      snapshot: false,
    });

    // tagId not extracted for M2M
    expect((result as any).tagId).toBeUndefined();
  });
});

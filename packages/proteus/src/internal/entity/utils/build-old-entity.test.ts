import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { buildOldEntity } from "./build-old-entity.js";

class Thing {
  id!: string;
  name!: string;
  age!: number;
  version!: number;
}

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("age", { type: "integer" }),
    makeField("version", { type: "integer", decorator: "Version" }),
  ],
  primaryKeys: ["id"],
  generated: [],
  relations: [],
} as unknown as EntityMetadata;

const makeThing = (values: Partial<Thing>): Thing => {
  const thing = new Thing();
  Object.entries(values).forEach(([key, value]) => {
    (thing as any)[key] = value;
  });
  return thing;
};

describe("buildOldEntity", () => {
  test("should return undefined when there is no snapshot", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 30, version: 2 });

    expect(buildOldEntity(entity, metadata, null)).toBeUndefined();
  });

  // The caller mutates its own instance before calling update(), so the
  // argument is already the new state — only the snapshot holds the old one.
  test("should overlay the snapshot's prior values onto the entity", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 31, version: 2 });
    const snapshot = { id: "1", name: "original", age: 30, version: 1 };

    expect(buildOldEntity(entity, metadata, snapshot)).toMatchSnapshot();
  });

  test("should return a copy, never the caller's instance", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 30, version: 2 });
    const snapshot = { id: "1", name: "original", age: 30, version: 1 };

    const old = buildOldEntity(entity, metadata, snapshot)!;

    expect(old).not.toBe(entity);

    old.name = "mutated by a subscriber";

    expect(entity.name).toBe("renamed");
  });

  test("should keep the entity prototype so the copy is still an entity", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 30, version: 2 });
    const snapshot = { id: "1", name: "original", age: 30, version: 1 };

    expect(buildOldEntity(entity, metadata, snapshot)).toBeInstanceOf(Thing);
  });

  // A partial projection hydrates only the columns it read, so the snapshot
  // has no prior value to restore — the current one must survive.
  test("should keep the current value for a column the snapshot never carried", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 30, version: 2 });
    const snapshot = { id: "1", name: "original" };

    const old = buildOldEntity(entity, metadata, snapshot)!;

    expect(old.name).toBe("original");
    expect(old.age).toBe(30);
    expect(old).not.toHaveProperty("undefined");
  });

  test("should restore a stored null rather than treating it as absent", () => {
    const entity = makeThing({ id: "1", name: "renamed", age: 30, version: 2 });
    const snapshot = { id: "1", name: null, age: 30, version: 1 };

    expect(buildOldEntity(entity, metadata, snapshot)!.name).toBeNull();
  });
});

describe("buildOldEntity — embedded fields", () => {
  class Address {
    street!: string;
    city!: string;
  }

  class Place {
    id!: string;
    address!: Address | null;
  }

  const embeddedMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("address.street", {
        type: "string",
        name: "address_street",
        embedded: { parentKey: "address", constructor: () => Address },
      }),
      makeField("address.city", {
        type: "string",
        name: "address_city",
        embedded: { parentKey: "address", constructor: () => Address },
      }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  const makePlace = (address: Address | null): Place => {
    const place = new Place();
    place.id = "1";
    place.address = address;
    return place;
  };

  const makeAddress = (street: string, city: string): Address => {
    const address = new Address();
    address.street = street;
    address.city = city;
    return address;
  };

  // The snapshot has no "address.street" key — the dotted keys are dropped at
  // hydration and the reconstructed parent object is stored under "address".
  test("should read the prior nested values from under the parent key", () => {
    const entity = makePlace(makeAddress("New St", "Shelbyville"));
    const snapshot = { id: "1", address: { street: "Old St", city: "Springfield" } };

    expect(buildOldEntity(entity, embeddedMetadata, snapshot)).toMatchSnapshot();
  });

  test("should rebuild the embeddable rather than alias the snapshot's object", () => {
    const entity = makePlace(makeAddress("New St", "Shelbyville"));
    const stored = { street: "Old St", city: "Springfield" };
    const snapshot = { id: "1", address: stored };

    const old = buildOldEntity(entity, embeddedMetadata, snapshot)!;

    expect(old.address).not.toBe(stored);
    expect(old.address).not.toBe(entity.address);
    expect(old.address).toBeInstanceOf(Address);

    old.address!.street = "mutated by a subscriber";

    expect(stored.street).toBe("Old St");
    expect(entity.address!.street).toBe("New St");
  });

  test("should restore a null embedded parent", () => {
    const entity = makePlace(makeAddress("First St", "Newtown"));
    const snapshot = { id: "1", address: null };

    expect(buildOldEntity(entity, embeddedMetadata, snapshot)!.address).toBeNull();
  });

  test("should leave the embedded parent alone when the snapshot never carried it", () => {
    const entity = makePlace(makeAddress("First St", "Newtown"));

    const old = buildOldEntity(entity, embeddedMetadata, { id: "1" })!;

    expect(old.address).toBe(entity.address);
  });
});

describe("buildOldEntity — relation FK columns", () => {
  class Post {
    id!: string;
    authorId!: string;
  }

  // Under the snake strategy the joinKey is the COLUMN name (author_id) while
  // the entity carries the property key (authorId).
  const relationMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("authorId", { type: "uuid", name: "author_id" }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [
      {
        key: "author",
        type: "ManyToOne",
        joinKeys: { author_id: "id" },
      },
    ],
  } as unknown as EntityMetadata;

  const makePost = (authorId: string): Post => {
    const post = new Post();
    post.id = "1";
    post.authorId = authorId;
    return post;
  };

  test("should read the FK by property key", () => {
    const entity = makePost("author-2");
    const snapshot = { id: "1", authorId: "author-1" };

    expect(buildOldEntity(entity, relationMetadata, snapshot)!.authorId).toBe("author-1");
  });

  // The heuristic snapshot built for manually-supplied relation data copies
  // whatever keys the object literally had, which can be the column name.
  test("should fall back to the column key when the property key is absent", () => {
    const entity = makePost("author-2");
    const snapshot = { id: "1", author_id: "author-1" };

    expect(buildOldEntity(entity, relationMetadata, snapshot)!.authorId).toBe("author-1");
  });

  test("should prefer the property key over the column key", () => {
    const entity = makePost("author-3");
    const snapshot = { id: "1", authorId: "author-1", author_id: "author-2" };

    expect(buildOldEntity(entity, relationMetadata, snapshot)!.authorId).toBe("author-1");
  });

  test("should keep the current FK when the snapshot carried neither key", () => {
    const entity = makePost("author-2");

    expect(buildOldEntity(entity, relationMetadata, { id: "1" })!.authorId).toBe(
      "author-2",
    );
  });

  test("should skip ManyToMany relations, which have no local FK column", () => {
    const manyToMany = {
      ...relationMetadata,
      relations: [{ key: "tags", type: "ManyToMany", joinKeys: { tag_id: "id" } }],
    } as unknown as EntityMetadata;

    const entity = makePost("author-2");
    const snapshot = { id: "1", authorId: "author-1", tagId: "tag-1" };

    expect(buildOldEntity(entity, manyToMany, snapshot)).not.toHaveProperty("tagId");
  });
});

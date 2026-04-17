import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import { ProteusError } from "../../../../../errors/ProteusError";
import { compileJoin } from "./compile-join";
import type { AliasMap } from "./compile-select";

// Mock getEntityMetadata so we control what metadata the join compiler sees
const postMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "posts",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title", { type: "string" }),
    makeField("status", { type: "string" }),
    makeField("authorId", { type: "uuid", name: "author_id" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const tagMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "tags",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("active", { type: "boolean" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const profileMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "profiles",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("userId", { type: "uuid", name: "user_id" }),
    makeField("bio", { type: "string" }),
    makeField("verified", { type: "boolean" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedPostMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "versioned_posts",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title", { type: "string" }),
    makeField("authorId", { type: "uuid", name: "author_id" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedTagMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "versioned_tags",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedProfileMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "versioned_profiles",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("userId", { type: "uuid", name: "user_id" }),
    makeField("bio", { type: "string" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

jest.mock("../../../../entity/metadata/get-entity-metadata", () => ({
  getEntityMetadata: jest.fn((ctor: any) => {
    if (ctor._name === "Post") return postMetadata;
    if (ctor._name === "Tag") return tagMetadata;
    if (ctor._name === "Profile") return profileMetadata;
    if (ctor._name === "VersionedPost") return versionedPostMetadata;
    if (ctor._name === "VersionedTag") return versionedTagMetadata;
    if (ctor._name === "VersionedProfile") return versionedProfileMetadata;
    throw new Error(`Unknown entity: ${ctor._name}`);
  }),
}));

const makeConstructor = (name: string) => {
  const ctor = class {} as any;
  ctor._name = name;
  return () => ctor;
};

const userMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("userId", { type: "uuid", name: "user_id" }),
  ],
  relations: [
    {
      key: "posts",
      foreignConstructor: makeConstructor("Post"),
      foreignKey: "authorId",
      findKeys: { authorId: "id" },
      joinKeys: null,
      joinTable: null,
      type: "OneToMany",
      options: {},
    } as unknown as MetaRelation,
    {
      key: "profile",
      foreignConstructor: makeConstructor("Profile"),
      foreignKey: "userId",
      findKeys: null,
      joinKeys: { userId: "id" },
      joinTable: null,
      type: "ManyToOne",
      options: {},
    } as unknown as MetaRelation,
    {
      key: "tags",
      foreignConstructor: makeConstructor("Tag"),
      foreignKey: "id",
      findKeys: { id: "tag_id" },
      joinKeys: { id: "user_id" },
      joinTable: "users_x_tags",
      type: "ManyToMany",
      options: {},
    } as unknown as MetaRelation,
  ],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const buildAliasMap = (includes: Array<{ relation: string }>): Array<AliasMap> => {
  const aliases: Array<AliasMap> = [
    {
      tableAlias: "t0",
      schema: "app",
      tableName: "users",
      relationKey: null,
      metadata: userMetadata,
    },
  ];

  let counter = 1;
  for (const inc of includes) {
    const rel = userMetadata.relations.find((r) => r.key === inc.relation);
    if (!rel) continue;

    if (rel.joinTable && typeof rel.joinTable === "string") {
      aliases.push({
        tableAlias: `t${counter++}`,
        schema: "app",
        tableName: rel.joinTable,
        relationKey: `${inc.relation}__join`,
        metadata: userMetadata,
      });
    }

    const foreignMeta =
      rel.key === "posts"
        ? postMetadata
        : rel.key === "tags"
          ? tagMetadata
          : profileMetadata;

    aliases.push({
      tableAlias: `t${counter++}`,
      schema: "app",
      tableName: foreignMeta.entity.name,
      relationKey: inc.relation,
      metadata: foreignMeta,
    });
  }

  return aliases;
};

describe("compileJoin", () => {
  describe("without where", () => {
    test("should compile inverse join (OneToMany)", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should compile owning join (ManyToOne)", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "profile" }]);
      const result = compileJoin(
        [
          {
            relation: "profile",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should compile ManyToMany join", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "tags" }]);
      const result = compileJoin(
        [
          {
            relation: "tags",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should compile INNER JOIN when required", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: true,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toContain("INNER JOIN");
    });
  });

  describe("with where", () => {
    test("should append where to inverse join ON clause", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { status: "published" },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["published"]);
    });

    test("should append where to owning join ON clause", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "profile" }]);
      const result = compileJoin(
        [
          {
            relation: "profile",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { verified: true },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([true]);
    });

    test("should append where to ManyToMany target join (second ON), not join table", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "tags" }]);
      const result = compileJoin(
        [
          {
            relation: "tags",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { active: true },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([true]);
      // The first JOIN (to join table) should NOT contain the where predicate
      const [firstJoin, secondJoin] = result
        .split(/(?=LEFT JOIN|INNER JOIN)/g)
        .filter(Boolean);
      expect(firstJoin).not.toContain("$1");
      expect(secondJoin).toContain("$1");
    });

    test("should handle complex predicates in ON clause", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: {
              status: { $in: ["published", "draft"] },
              title: { $ilike: "%hello%" },
            },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["published", "draft", "%hello%"]);
    });

    test("should use INNER JOIN with where when required", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: true,
            strategy: "join" as const,
            select: null,
            where: { status: "published" },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toContain("INNER JOIN");
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["published"]);
    });

    test("should correctly increment params across join and root where", () => {
      const params: Array<unknown> = ["existing_param"]; // Simulate pre-existing param from root where
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { status: "active" },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(params).toEqual(["existing_param", "active"]);
      expect(result).toContain("$2"); // Not $1 — offset by pre-existing param
    });

    test("should handle where with $and logical operator", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { $and: [{ status: "published" }, { title: { $like: "%test%" } }] },
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["published", "%test%"]);
    });
  });

  describe("version filtering on joined tables", () => {
    const versionedUserMetadata = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "users",
        namespace: "app",
      },
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("name", { type: "string" }),
        makeField("userId", { type: "uuid", name: "user_id" }),
      ],
      relations: [
        {
          key: "versionedPosts",
          foreignConstructor: makeConstructor("VersionedPost"),
          foreignKey: "authorId",
          findKeys: { authorId: "id" },
          joinKeys: null,
          joinTable: null,
          type: "OneToMany",
          options: {},
        } as unknown as MetaRelation,
        {
          key: "versionedProfile",
          foreignConstructor: makeConstructor("VersionedProfile"),
          foreignKey: "userId",
          findKeys: null,
          joinKeys: { userId: "id" },
          joinTable: null,
          type: "ManyToOne",
          options: {},
        } as unknown as MetaRelation,
        {
          key: "versionedTags",
          foreignConstructor: makeConstructor("VersionedTag"),
          foreignKey: "id",
          findKeys: { id: "tag_id" },
          joinKeys: { id: "user_id" },
          joinTable: "users_x_versioned_tags",
          type: "ManyToMany",
          options: {},
        } as unknown as MetaRelation,
      ],
      primaryKeys: ["id"],
    } as unknown as EntityMetadata;

    const buildVersionedAliasMap = (
      includes: Array<{ relation: string }>,
    ): Array<AliasMap> => {
      const aliases: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: "app",
          tableName: "users",
          relationKey: null,
          metadata: versionedUserMetadata,
        },
      ];

      let counter = 1;
      for (const inc of includes) {
        const rel = versionedUserMetadata.relations.find((r) => r.key === inc.relation);
        if (!rel) continue;

        if (rel.joinTable && typeof rel.joinTable === "string") {
          aliases.push({
            tableAlias: `t${counter++}`,
            schema: "app",
            tableName: rel.joinTable,
            relationKey: `${inc.relation}__join`,
            metadata: versionedUserMetadata,
          });
        }

        const foreignMeta =
          rel.key === "versionedPosts"
            ? versionedPostMetadata
            : rel.key === "versionedTags"
              ? versionedTagMetadata
              : versionedProfileMetadata;

        aliases.push({
          tableAlias: `t${counter++}`,
          schema: "app",
          tableName: foreignMeta.entity.name,
          relationKey: inc.relation,
          metadata: foreignMeta,
        });
      }

      return aliases;
    };

    test("should add version_end_date IS NULL to inverse join (OneToMany) on versioned entity", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedPosts" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedPosts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should add version_end_date IS NULL to owning join (ManyToOne) on versioned entity", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedProfile" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedProfile",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should add version_end_date IS NULL to ManyToMany target join on versioned entity", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedTags" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedTags",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    test("should not add version condition to non-versioned joined entity", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildAliasMap([{ relation: "posts" }]);
      const result = compileJoin(
        [
          {
            relation: "posts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        userMetadata,
        aliasMap,
        params,
      );
      expect(result).not.toContain("version_end_date");
    });

    test("should combine version condition with where on versioned joined entity", () => {
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedPosts" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedPosts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { title: "test" },
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["test"]);
    });

    test("should emit point-in-time range condition on inverse join when versionTimestamp is set", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedPosts" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedPosts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
        timestamp,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([timestamp]);
    });

    test("should emit point-in-time range condition on owning join when versionTimestamp is set", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedProfile" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedProfile",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
        timestamp,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([timestamp]);
    });

    test("should emit point-in-time range condition on ManyToMany target join when versionTimestamp is set", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      const params: Array<unknown> = [];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedTags" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedTags",
            required: false,
            strategy: "join" as const,
            select: null,
            where: null,
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
        timestamp,
      );
      expect(result).toMatchSnapshot();
      expect(params).toEqual([timestamp]);
    });

    test("should have correct param indices when combining point-in-time join with pre-existing params", () => {
      const timestamp = new Date("2025-06-15T12:00:00Z");
      const params: Array<unknown> = ["existing_where_param"];
      const aliasMap = buildVersionedAliasMap([{ relation: "versionedPosts" }]);
      const result = compileJoin(
        [
          {
            relation: "versionedPosts",
            required: false,
            strategy: "join" as const,
            select: null,
            where: { title: "test" },
          },
        ],
        versionedUserMetadata,
        aliasMap,
        params,
        timestamp,
      );
      expect(result).toMatchSnapshot();
      // timestamp=$2, title=$3 (offset by pre-existing param)
      expect(params).toEqual(["existing_where_param", timestamp, "test"]);
    });
  });

  describe("missing alias errors", () => {
    test("should throw ProteusError when owning relation has no alias in aliasMap", () => {
      // aliasMap only has the root entry — no entry for the "profile" relation
      const emptyAliasMap: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: "app",
          tableName: "users",
          relationKey: null,
          metadata: userMetadata,
        },
      ];

      expect(() =>
        compileJoin(
          [
            {
              relation: "profile",
              required: false,
              strategy: "join" as const,
              select: null,
              where: null,
            },
          ],
          userMetadata,
          emptyAliasMap,
          [],
        ),
      ).toThrow(ProteusError);
    });

    test("should throw ProteusError when inverse relation has no alias in aliasMap", () => {
      const emptyAliasMap: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: "app",
          tableName: "users",
          relationKey: null,
          metadata: userMetadata,
        },
      ];

      expect(() =>
        compileJoin(
          [
            {
              relation: "posts",
              required: false,
              strategy: "join" as const,
              select: null,
              where: null,
            },
          ],
          userMetadata,
          emptyAliasMap,
          [],
        ),
      ).toThrow(ProteusError);
    });

    test("should throw ProteusError when ManyToMany relation has no alias in aliasMap", () => {
      const emptyAliasMap: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: "app",
          tableName: "users",
          relationKey: null,
          metadata: userMetadata,
        },
      ];

      expect(() =>
        compileJoin(
          [
            {
              relation: "tags",
              required: false,
              strategy: "join" as const,
              select: null,
              where: null,
            },
          ],
          userMetadata,
          emptyAliasMap,
          [],
        ),
      ).toThrow(ProteusError);
    });
  });
});

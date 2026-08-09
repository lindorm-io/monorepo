/**
 * A `@RelationId` takes the shape of the relation it names, and the drivers
 * that query per entity used to get it wrong: a `OneToMany` was read with
 * findOne, so one child's id came back as a bare string while the relational
 * drivers returned every child's id as an array. The value was not merely
 * mis-typed — it was short, silently.
 *
 * Memory stands in for the document drivers here (mongo and redis run the same
 * shared loader) and needs no service to do it.
 */

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, describe, expect, test } from "vitest";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import {
  Cascade,
  Entity,
  Field,
  Generated,
  JoinKey,
  JoinTable,
  ManyToMany,
  ManyToOne,
  Nullable,
  OneToMany,
  OneToOne,
  PrimaryKeyField,
  RelationId,
} from "../../../../decorators/index.js";

@Entity({ name: "RiShapeAuthor" })
class RiShapeAuthor {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => RiShapePost, "author")
  posts!: Array<RiShapePost>;

  @RelationId<RiShapeAuthor>("posts")
  postIds!: Array<string>;
}

@Entity({ name: "RiShapePost" })
class RiShapePost {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;

  @Nullable()
  @Field("uuid")
  authorId!: string | null;

  @JoinKey({ authorId: "id" })
  @ManyToOne(() => RiShapeAuthor, "posts")
  author!: RiShapeAuthor | null;

  @RelationId<RiShapePost>("author")
  owningAuthorId!: string | null;

  @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
  @JoinTable()
  @ManyToMany(() => RiShapeTag, "posts")
  tags!: Array<RiShapeTag>;

  @RelationId<RiShapePost>("tags")
  tagIds!: Array<string>;
}

@Entity({ name: "RiShapeTag" })
class RiShapeTag {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  label!: string;

  @ManyToMany(() => RiShapePost, "tags")
  posts!: Array<RiShapePost>;
}

@Entity({ name: "RiShapeProfile" })
class RiShapeProfile {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => RiShapeUser, "profile")
  user!: RiShapeUser | null;

  @RelationId<RiShapeProfile>("user")
  userId!: string | null;
}

@Entity({ name: "RiShapeUser" })
class RiShapeUser {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  handle!: string;

  @Nullable()
  @Field("uuid")
  profileId!: string | null;

  @JoinKey({ profileId: "id" })
  @OneToOne(() => RiShapeProfile, "user")
  profile!: RiShapeProfile | null;
}

describe("MemoryRepository @RelationId shape", () => {
  let source: ProteusSource;

  let authorId: string;
  let postIds: Array<string>;
  let taggedPostId: string;
  let tagIds: Array<string>;
  let takenProfileId: string;
  let freeProfileId: string;
  let userId: string;
  let childlessAuthorId: string;
  let untaggedPostId: string;

  beforeAll(async () => {
    source = new ProteusSource({
      driver: "memory",
      entities: [RiShapeAuthor, RiShapePost, RiShapeTag, RiShapeProfile, RiShapeUser],
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();

    const authors = source.repository(RiShapeAuthor);
    const posts = source.repository(RiShapePost);
    const tags = source.repository(RiShapeTag);
    const profiles = source.repository(RiShapeProfile);
    const users = source.repository(RiShapeUser);

    const author = await authors.insert({ name: "Alice" });
    const first = await posts.insert({ title: "First", authorId: author.id });
    const second = await posts.insert({ title: "Second", authorId: author.id });
    const third = await posts.insert({ title: "Third", authorId: author.id });

    authorId = author.id;
    postIds = [first.id, second.id, third.id];

    childlessAuthorId = (await authors.insert({ name: "Bob" })).id;

    const red = await tags.insert({ label: "red" });
    const blue = await tags.insert({ label: "blue" });
    const tagged = await posts.findOneOrFail({ id: first.id });
    tagged.tags = [red, blue];
    await posts.save(tagged);

    taggedPostId = first.id;
    tagIds = [red.id, blue.id];
    untaggedPostId = second.id;

    const takenProfile = await profiles.insert({ bio: "taken" });
    const user = await users.insert({ handle: "alice", profileId: takenProfile.id });

    takenProfileId = takenProfile.id;
    userId = user.id;
    freeProfileId = (await profiles.insert({ bio: "free" })).id;
  });

  test("a OneToMany relation id carries every child's id", async () => {
    const author = await source.repository(RiShapeAuthor).findOneOrFail({ id: authorId });

    expect(Array.isArray(author.postIds)).toBe(true);
    expect(author.postIds).toHaveLength(3);
    expect([...author.postIds].sort()).toEqual([...postIds].sort());
  });

  test("a OneToMany relation id with no children is an empty array", async () => {
    const author = await source
      .repository(RiShapeAuthor)
      .findOneOrFail({ id: childlessAuthorId });

    expect(author.postIds).toEqual([]);
  });

  test("a ManyToMany relation id carries every related id", async () => {
    const post = await source.repository(RiShapePost).findOneOrFail({
      id: taggedPostId,
    });

    expect([...post.tagIds].sort()).toEqual([...tagIds].sort());
  });

  test("a ManyToMany relation id with nothing joined is an empty array", async () => {
    const post = await source.repository(RiShapePost).findOneOrFail({
      id: untaggedPostId,
    });

    expect(post.tagIds).toEqual([]);
  });

  test("an owning *ToOne relation id is the single foreign key value", async () => {
    const post = await source.repository(RiShapePost).findOneOrFail({
      id: taggedPostId,
    });

    expect(post.owningAuthorId).toBe(authorId);
  });

  test("an inverse OneToOne relation id is the single counterpart id", async () => {
    const profile = await source
      .repository(RiShapeProfile)
      .findOneOrFail({ id: takenProfileId });

    expect(profile.userId).toBe(userId);
  });

  // The loader used to leave the property untouched when it found nothing, so
  // an unmatched inverse relation came back absent here and null on the
  // relational drivers.
  test("an inverse OneToOne relation id with no counterpart is null", async () => {
    const profile = await source
      .repository(RiShapeProfile)
      .findOneOrFail({ id: freeProfileId });

    expect(profile.userId).toBeNull();
  });
});

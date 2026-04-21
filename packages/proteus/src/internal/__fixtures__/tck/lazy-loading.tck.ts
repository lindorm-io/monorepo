import { test, it, expect, beforeEach } from "vitest";
// TCK: Lazy Loading Suite
// Tests lazy relation loading via custom thenables (LazyRelation / LazyCollection).

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { isLazyRelation, LAZY_RELATION } from "../../entity/utils/lazy-relation";
import { isLazyCollection, LAZY_COLLECTION } from "../../entity/utils/lazy-collection";

export const lazyLoadingSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const {
    TckLazyUser,
    TckLazyPost,
    TckLazyOwner,
    TckLazyDetail,
    TckLazyLeft,
    TckLazyRight,
    TckScopedUser,
    TckScopedPost,
  } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  // ─── L1: Lazy ManyToOne ──────────────────────────────────────────────

  test("lazy ManyToOne: await post.author returns User", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "Author1" });
    await postRepo.insert({ title: "Post1", authorId: user.id });

    const posts = await postRepo.find();
    expect(posts).toHaveLength(1);

    // Before await, property is a thenable (not the resolved User)
    expect(isLazyRelation(posts[0].author)).toBe(true);

    // After await, returns the actual User
    const author = await posts[0].author;
    expect(author).not.toBeNull();
    expect(author!.name).toBe("Author1");
    expect(author!.id).toBe(user.id);
  });

  // ─── L2: Lazy OneToMany ──────────────────────────────────────────────

  test("lazy OneToMany: await user.posts returns Post[]", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "Author2" });
    await postRepo.insert({ title: "PostA", authorId: user.id });
    await postRepo.insert({ title: "PostB", authorId: user.id });

    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();

    // Before await, property is a LazyCollection
    expect(isLazyCollection(found!.posts)).toBe(true);

    // After await, returns array
    const posts = await found!.posts;
    expect(posts).toHaveLength(2);
    const titles = posts.map((p) => p.title).sort();
    expect(titles).toEqual(["PostA", "PostB"]);
  });

  // ─── L3: Lazy ManyToMany ─────────────────────────────────────────────

  test("lazy ManyToMany: await left.rights returns Right[]", async () => {
    const leftRepo = getHandle().repository(TckLazyLeft);
    const rightRepo = getHandle().repository(TckLazyRight);

    const r1 = await rightRepo.insert({ label: "R1" });
    const r2 = await rightRepo.insert({ label: "R2" });
    await leftRepo.save({ label: "L1", rights: [r1, r2] });

    const lefts = await leftRepo.find();
    expect(lefts).toHaveLength(1);

    expect(isLazyCollection(lefts[0].rights)).toBe(true);

    const rights = await lefts[0].rights;
    expect(rights).toHaveLength(2);
    const labels = rights.map((r) => r.label).sort();
    expect(labels).toEqual(["R1", "R2"]);
  });

  // ─── L4: Null FK short-circuit ───────────────────────────────────────

  test("null FK: await post.author returns null (no thenable)", async () => {
    const postRepo = getHandle().repository(TckLazyPost);
    const post = await postRepo.insert({ title: "Orphan" });

    const found = await postRepo.findOne({ id: post.id });
    expect(found).not.toBeNull();
    expect(found!.authorId).toBeNull();

    // Null FK short-circuit: property is plain null (not a thenable)
    expect(isLazyRelation(found!.author)).toBe(false);
    expect(found!.author).toBeNull();

    // await on null still returns null (Promise.resolve(null))
    const author = await found!.author;
    expect(author).toBeNull();
  });

  // ─── L5: Caching (memoization) ──────────────────────────────────────

  test("caching: second await returns same result without new query", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "CachedAuthor" });
    await postRepo.insert({ title: "CachedPost", authorId: user.id });

    const posts = await postRepo.find();
    const post = posts[0];

    const author1 = await post.author;
    const author2 = await post.author;

    // Same value returned both times
    expect(author1).not.toBeNull();
    expect(author2).not.toBeNull();
    expect(author1!.id).toBe(author2!.id);
    expect(author1!.name).toBe("CachedAuthor");
  });

  // ─── L6: Self-replacement ───────────────────────────────────────────

  test("self-replacement: after await, property is plain value (not thenable)", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "SelfReplace" });
    await postRepo.insert({ title: "SR-Post", authorId: user.id });

    const posts = await postRepo.find();
    const post = posts[0];

    // Before: thenable
    expect(isLazyRelation(post.author)).toBe(true);

    // Trigger resolution
    await post.author;

    // After: plain value, no longer a thenable
    expect(isLazyRelation(post.author)).toBe(false);
    expect(post.author).not.toBeNull();
    expect(post.author!.name).toBe("SelfReplace");
  });

  // ─── L7: Eager override via FindOptions.relations ───────────────────

  test("eager override: relations option on lazy relation loads eagerly", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "EagerOverride" });
    await postRepo.insert({ title: "EO-Post", authorId: user.id });

    // Explicitly request the lazy relation — should be eagerly loaded
    const posts = await postRepo.find({}, { relations: ["author"] });
    expect(posts).toHaveLength(1);

    // Property should be the actual User, NOT a thenable
    expect(isLazyRelation(posts[0].author)).toBe(false);
    expect(posts[0].author).not.toBeNull();
    expect(posts[0].author!.name).toBe("EagerOverride");
  });

  // ─── L8: Save with unresolved lazy ──────────────────────────────────

  test("save with unresolved lazy: FK unchanged, no cascade error", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "SaveTest" });
    await postRepo.insert({ title: "Save-Post", authorId: user.id });

    const posts = await postRepo.find();
    const post = posts[0];

    // Don't resolve the lazy author — just update the title
    expect(isLazyRelation(post.author)).toBe(true);
    post.title = "Updated-Post";

    const saved = await postRepo.save(post);
    expect(saved.title).toBe("Updated-Post");
    expect(saved.authorId).toBe(user.id);

    // Verify FK preserved
    const found = await postRepo.findOne({ id: post.id });
    expect(found).not.toBeNull();
    expect(found!.authorId).toBe(user.id);
    expect(found!.title).toBe("Updated-Post");
  });

  // ─── L9: Orphan guard ───────────────────────────────────────────────

  test("orphan guard: update with unloaded OneToMany does not delete children", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "OrphanGuard" });
    await postRepo.insert({ title: "Child1", authorId: user.id });
    await postRepo.insert({ title: "Child2", authorId: user.id });

    // Find user — posts are lazy (not loaded)
    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.posts)).toBe(true);

    // Update user without resolving posts
    found!.name = "OrphanGuardUpdated";
    await userRepo.save(found!);

    // Children should still exist
    const childPosts = await postRepo.find({ authorId: user.id });
    expect(childPosts).toHaveLength(2);
  });

  // ─── L10: Clone with unresolved lazy ────────────────────────────────

  test("clone with unresolved lazy: clone gets null/[]", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "CloneTest" });
    await postRepo.insert({ title: "Clone-Post", authorId: user.id });

    const posts = await postRepo.find();
    const post = posts[0];

    // Unresolved lazy — clone should get null (singular) or [] (collection)
    expect(isLazyRelation(post.author)).toBe(true);

    const cloned = postRepo.create(post);
    // Cloned entity should have null author (lazy was treated as "not loaded")
    expect(cloned.author).toBeNull();
  });

  // ─── L11: JSON.stringify ────────────────────────────────────────────

  test("JSON.stringify: unresolved lazy relation omitted from output", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "JsonTest" });
    await postRepo.insert({ title: "Json-Post", authorId: user.id });

    const posts = await postRepo.find();
    const post = posts[0];

    // Unresolved — toJSON returns undefined, so omitted from JSON output
    const json = JSON.parse(JSON.stringify(post));
    expect(json.title).toBe("Json-Post");
    expect(json.authorId).toBe(user.id);
    expect(json.author).toBeUndefined();

    // After resolving, it appears in JSON
    await post.author;
    const json2 = JSON.parse(JSON.stringify(post));
    expect(json2.author).not.toBeNull();
    expect(json2.author.name).toBe("JsonTest");
  });

  // ─── L12: Truthiness ───────────────────────────────────────────────

  test("truthiness: thenable is truthy when FK non-null, null when FK null", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    const postRepo = getHandle().repository(TckLazyPost);

    const user = await userRepo.insert({ name: "TruthTest" });
    await postRepo.insert({ title: "HasAuthor", authorId: user.id });
    await postRepo.insert({ title: "NoAuthor" });

    const posts = await postRepo.find();
    const withAuthor = posts.find((p) => p.title === "HasAuthor")!;
    const withoutAuthor = posts.find((p) => p.title === "NoAuthor")!;

    // Non-null FK: thenable is truthy
    expect(!!withAuthor.author).toBe(true);

    // Null FK: null is falsy
    expect(!!withoutAuthor.author).toBe(false);
  });

  // ─── L13: Lazy OneToOne (owning side) ───────────────────────────────

  test("lazy OneToOne: await owner.detail returns Detail", async () => {
    const ownerRepo = getHandle().repository(TckLazyOwner);
    const detailRepo = getHandle().repository(TckLazyDetail);

    const detail = await detailRepo.insert({ info: "lazy-detail" });
    await ownerRepo.insert({ name: "LazyOwner", detailId: detail.id });

    const owners = await ownerRepo.find();
    expect(owners).toHaveLength(1);

    expect(isLazyRelation(owners[0].detail)).toBe(true);

    const loadedDetail = await owners[0].detail;
    expect(loadedDetail).not.toBeNull();
    expect(loadedDetail!.info).toBe("lazy-detail");
  });

  // ─── L14: Lazy OneToOne null ────────────────────────────────────────

  test("lazy OneToOne: null FK returns null (no thenable)", async () => {
    const ownerRepo = getHandle().repository(TckLazyOwner);
    await ownerRepo.insert({ name: "NoDetail" });

    const owners = await ownerRepo.find();
    expect(owners).toHaveLength(1);

    expect(isLazyRelation(owners[0].detail)).toBe(false);
    expect(owners[0].detail).toBeNull();
  });

  // ─── L15: Lazy OneToOne (inverse side) ──────────────────────────────

  test("lazy OneToOne inverse: await detail.owner returns Owner", async () => {
    const ownerRepo = getHandle().repository(TckLazyOwner);
    const detailRepo = getHandle().repository(TckLazyDetail);

    const detail = await detailRepo.insert({ info: "inv-detail" });
    await ownerRepo.insert({ name: "InvOwner", detailId: detail.id });

    const details = await detailRepo.find();
    expect(details).toHaveLength(1);

    // Inverse side: no FK on this entity, so always a thenable
    expect(isLazyRelation(details[0].owner)).toBe(true);

    const owner = await details[0].owner;
    expect(owner).not.toBeNull();
    expect(owner!.name).toBe("InvOwner");
  });

  // ─── L16: Lazy ManyToMany (inverse side) ────────────────────────────

  test("lazy ManyToMany inverse: await right.lefts returns Left[]", async () => {
    const leftRepo = getHandle().repository(TckLazyLeft);
    const rightRepo = getHandle().repository(TckLazyRight);

    const r1 = await rightRepo.insert({ label: "InvR1" });
    await leftRepo.save({ label: "InvL1", rights: [r1] });
    await leftRepo.save({ label: "InvL2", rights: [r1] });

    const rights = await rightRepo.find();
    expect(rights).toHaveLength(1);

    expect(isLazyCollection(rights[0].lefts)).toBe(true);

    const lefts = await rights[0].lefts;
    expect(lefts).toHaveLength(2);
    const labels = lefts.map((l) => l.label).sort();
    expect(labels).toEqual(["InvL1", "InvL2"]);
  });

  // ─── L17: User with no posts — lazy collection returns [] ──────────

  test("lazy collection: user with no posts returns empty array", async () => {
    const userRepo = getHandle().repository(TckLazyUser);
    await userRepo.insert({ name: "NoPosts" });

    const users = await userRepo.find();
    expect(users).toHaveLength(1);

    const posts = await users[0].posts;
    expect(posts).toEqual([]);
  });

  // ─── L18: Scoped loading — find() lazy, findOne() eager ───────────

  test("scoped: find() returns lazy thenable, findOne() returns eager data", async () => {
    const userRepo = getHandle().repository(TckScopedUser);
    const postRepo = getHandle().repository(TckScopedPost);

    const user = await userRepo.insert({ name: "ScopedUser" });
    await postRepo.insert({ title: "ScopedPost", authorId: user.id });

    // find() → lazy on this entity
    const posts = await postRepo.find();
    expect(posts).toHaveLength(1);
    expect(isLazyRelation(posts[0].author)).toBe(true);

    // resolve the lazy thenable to verify it works
    const author = await posts[0].author;
    expect(author).not.toBeNull();
    expect(author!.name).toBe("ScopedUser");

    // findOne() → eager on this entity
    const post = await postRepo.findOne({ id: posts[0].id });
    expect(post).not.toBeNull();
    expect(isLazyRelation(post!.author)).toBe(false);
    expect(post!.author).not.toBeNull();
    expect(post!.author!.name).toBe("ScopedUser");
  });

  // ─── L19: Scoped loading — OneToMany find() lazy, findOne() eager ─

  test("scoped: OneToMany find() returns lazy collection, findOne() returns eager array", async () => {
    const userRepo = getHandle().repository(TckScopedUser);
    const postRepo = getHandle().repository(TckScopedPost);

    const user = await userRepo.insert({ name: "ScopedAuthor" });
    await postRepo.insert({ title: "SP1", authorId: user.id });
    await postRepo.insert({ title: "SP2", authorId: user.id });

    // find() → lazy collection
    const users = await userRepo.find();
    expect(users).toHaveLength(1);
    expect(isLazyCollection(users[0].posts)).toBe(true);

    // resolve the lazy collection
    const lazyPosts = await users[0].posts;
    expect(lazyPosts).toHaveLength(2);

    // findOne() → eager array
    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.posts)).toBe(false);
    expect(Array.isArray(found!.posts)).toBe(true);
    expect(found!.posts).toHaveLength(2);
    const titles = found!.posts.map((p: any) => p.title).sort();
    expect(titles).toEqual(["SP1", "SP2"]);
  });
};

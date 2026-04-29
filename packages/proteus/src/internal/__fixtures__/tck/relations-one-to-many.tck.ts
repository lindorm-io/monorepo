import { test, it, expect, beforeEach } from "vitest";
// TCK: Relations OneToMany Suite
// Tests OneToMany/ManyToOne: TckSimpleUser (1) -> TckSimplePost (N).

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const relationsOneToManySuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckSimpleUser, TckSimplePost, TckCascadeParent, TckCascadeChild } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("insert user then post with FK, find loads relation", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const user = await userRepo.insert({ name: "Author1", age: 30 });
    await postRepo.insert({ title: "Post1", authorId: user.id });
    await postRepo.insert({ title: "Post2", authorId: user.id });

    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();
    expect(found!.posts).toHaveLength(2);
  });

  test("find post eager-loads author (ManyToOne)", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const user = await userRepo.insert({ name: "Author2", age: 25 });
    await postRepo.insert({ title: "PostA", authorId: user.id });

    const posts = await postRepo.find();
    expect(posts).toHaveLength(1);
    expect(posts[0].author).not.toBeNull();
    expect(posts[0].author!.name).toBe("Author2");
  });

  test("post without author has null FK", async () => {
    const postRepo = getHandle().repository(TckSimplePost);
    const post = await postRepo.insert({ title: "Orphan" });

    expect(post.authorId).toBeNull();

    // Verify via find — eager loading returns null for the relation
    const found = await postRepo.findOne({ id: post.id });
    expect(found).not.toBeNull();
    expect(found!.authorId).toBeNull();
    expect(found!.author).toBeNull();
  });

  test("cascade save on user creates posts", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const post1 = postRepo.create({ title: "CascadePost1" });
    const post2 = postRepo.create({ title: "CascadePost2" });
    const saved = await userRepo.save({ name: "CascadeUser", posts: [post1, post2] });

    // Verify via find — RETURNING doesn't include relation objects
    const found = await userRepo.findOne({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.posts).toHaveLength(2);

    const allPosts = await postRepo.find();
    expect(allPosts).toHaveLength(2);
    allPosts.forEach((p) => {
      expect(p.authorId).toBe(saved.id);
    });
  });

  test("user with no posts has empty array", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const user = await userRepo.insert({ name: "NoPostsUser" });

    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();
    expect(found!.posts).toEqual([]);
  });

  test("cascade update adds new child alongside existing ones", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    // Insert user with 2 posts via cascade save
    const post1 = postRepo.create({ title: "CascadeUpdatePost1" });
    const post2 = postRepo.create({ title: "CascadeUpdatePost2" });
    const saved = await userRepo.save({
      name: "CascadeUpdateUser",
      posts: [post1, post2],
    });

    // Reload to get the persisted posts with their IDs
    const reloaded = await userRepo.findOne({ id: saved.id });
    expect(reloaded).not.toBeNull();
    expect(reloaded!.posts).toHaveLength(2);

    // Add a new (unsaved) post to the array and re-save the parent
    // onUpdate: "cascade" will insert the new child and set its FK
    const newPost = postRepo.create({ title: "CascadeUpdatePost3" });
    reloaded!.posts.push(newPost);
    await userRepo.save(reloaded!);

    // Verify all 3 posts exist and are associated with the user
    const reloadedAgain = await userRepo.findOne({ id: saved.id });
    expect(reloadedAgain).not.toBeNull();
    expect(reloadedAgain!.posts).toHaveLength(3);

    const allPosts = await postRepo.find();
    expect(allPosts).toHaveLength(3);
    allPosts.forEach((p) => {
      expect(p.authorId).toBe(saved.id);
    });
  });

  test("reassign child FK to different parent", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const userA = await userRepo.insert({ name: "UserA", age: 20 });
    const userB = await userRepo.insert({ name: "UserB", age: 21 });
    const post = await postRepo.insert({ title: "ReassignPost", authorId: userA.id });

    // Reload full entity then update: reassign FK to user B
    const postToUpdate = await postRepo.findOneOrFail({ id: post.id });
    await postRepo.update({ ...postToUpdate, authorId: userB.id });

    // User B should now have the post
    const foundB = await userRepo.findOne({ id: userB.id });
    expect(foundB).not.toBeNull();
    expect(foundB!.posts).toHaveLength(1);
    expect(foundB!.posts[0].id).toBe(post.id);

    // User A should have no posts
    const foundA = await userRepo.findOne({ id: userA.id });
    expect(foundA).not.toBeNull();
    expect(foundA!.posts).toHaveLength(0);
  });

  test("ORM cascade destroy removes children", async () => {
    const parentRepo = getHandle().repository(TckCascadeParent);
    const childRepo = getHandle().repository(TckCascadeChild);

    const c1 = childRepo.create({ label: "Child1" });
    const c2 = childRepo.create({ label: "Child2" });
    const saved = await parentRepo.save({ name: "Parent1", children: [c1, c2] });

    // Reload to confirm children were created
    const reloaded = await parentRepo.findOne({ id: saved.id });
    expect(reloaded).not.toBeNull();
    expect(reloaded!.children).toHaveLength(2);

    // Capture child IDs before destroy
    const childIds = reloaded!.children.map((c) => c.id);

    // Destroy parent — onDestroy: "cascade" should remove children via ORM
    await parentRepo.destroy(reloaded!);

    // Verify children are gone from DB
    for (const childId of childIds) {
      const found = await childRepo.findOne({ id: childId });
      expect(found).toBeNull();
    }
  });

  test("orphan delete removes child when removed from parent", async () => {
    const parentRepo = getHandle().repository(TckCascadeParent);
    const childRepo = getHandle().repository(TckCascadeChild);

    const c1 = childRepo.create({ label: "Keep" });
    const c2 = childRepo.create({ label: "Remove" });
    const saved = await parentRepo.save({ name: "Parent2", children: [c1, c2] });

    // Reload to get persisted children with IDs
    const reloaded = await parentRepo.findOne({ id: saved.id });
    expect(reloaded).not.toBeNull();
    expect(reloaded!.children).toHaveLength(2);

    const keptChild = reloaded!.children.find((c) => c.label === "Keep")!;
    const removedChild = reloaded!.children.find((c) => c.label === "Remove")!;

    // Remove c2 from the children array and save — onOrphan: "delete" should remove it
    reloaded!.children = [keptChild];
    await parentRepo.save(reloaded!);

    // Verify the removed child was deleted from DB
    const foundRemoved = await childRepo.findOne({ id: removedChild.id });
    expect(foundRemoved).toBeNull();

    // Verify the kept child still exists
    const foundKept = await childRepo.findOne({ id: keptChild.id });
    expect(foundKept).not.toBeNull();
  });

  // ─── Batch isolation: find() multiple users each loads own posts ───────────
  test("find() with multiple users loads correct posts per user without cross-contamination", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const u1 = await userRepo.insert({ name: "BatchUser1", age: 10 });
    const u2 = await userRepo.insert({ name: "BatchUser2", age: 20 });
    const u3 = await userRepo.insert({ name: "BatchUser3", age: 30 });

    await postRepo.insert({ title: "U1-P1", authorId: u1.id });
    await postRepo.insert({ title: "U1-P2", authorId: u1.id });
    await postRepo.insert({ title: "U2-P1", authorId: u2.id });
    await postRepo.insert({ title: "U3-P1", authorId: u3.id });
    await postRepo.insert({ title: "U3-P2", authorId: u3.id });
    await postRepo.insert({ title: "U3-P3", authorId: u3.id });

    const all = await userRepo.find(undefined, { order: { name: "ASC" } });
    expect(all).toHaveLength(3);

    const found1 = all.find((u) => u.name === "BatchUser1")!;
    const found2 = all.find((u) => u.name === "BatchUser2")!;
    const found3 = all.find((u) => u.name === "BatchUser3")!;

    expect(found1.posts).toHaveLength(2);
    expect(found2.posts).toHaveLength(1);
    expect(found3.posts).toHaveLength(3);

    expect(found1.posts.every((p) => p.authorId === u1.id)).toBe(true);
    expect(found2.posts.every((p) => p.authorId === u2.id)).toBe(true);
    expect(found3.posts.every((p) => p.authorId === u3.id)).toBe(true);
  });

  // ─── User with no posts alongside users with posts ─────────────────────────
  test("user with no posts gets empty array when loaded alongside users with posts", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const withPosts = await userRepo.insert({ name: "HasPosts", age: 1 });
    const noPosts = await userRepo.insert({ name: "NoPosts", age: 2 });
    await postRepo.insert({ title: "SomePost", authorId: withPosts.id });

    const all = await userRepo.find();
    const foundWith = all.find((u) => u.name === "HasPosts")!;
    const foundNo = all.find((u) => u.name === "NoPosts")!;

    expect(foundWith.posts).toHaveLength(1);
    expect(foundNo.posts).toHaveLength(0);
  });

  // ─── Orphan post (null FK) doesn't corrupt other users' relation loading ─
  test("orphan post with null FK does not corrupt other users' relation loading", async () => {
    const userRepo = getHandle().repository(TckSimpleUser);
    const postRepo = getHandle().repository(TckSimplePost);

    const user = await userRepo.insert({ name: "RealAuthor", age: 30 });
    await postRepo.insert({ title: "P1", authorId: user.id });
    await postRepo.insert({ title: "P2", authorId: user.id });
    await postRepo.insert({ title: "Orphan", authorId: null });

    const found = await userRepo.findOne({ id: user.id });
    expect(found).not.toBeNull();
    expect(found!.posts).toHaveLength(2);

    const titles = found!.posts.map((p) => p.title).sort();
    expect(titles).toEqual(["P1", "P2"]);
  });
};

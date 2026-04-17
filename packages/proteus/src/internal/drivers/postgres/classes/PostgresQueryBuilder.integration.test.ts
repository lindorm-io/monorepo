import { randomBytes, randomUUID } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../__fixtures__/create-test-pg-client";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import { projectDesiredSchema } from "../utils/sync/project-desired-schema";
import { introspectSchema } from "../utils/sync/introspect-schema";
import { diffSchema } from "../utils/sync/diff-schema";
import { SyncPlanExecutor } from "../utils/sync/execute-sync-plan";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";
import "../../../__fixtures__/test-entities";
import {
  TestUser,
  TestPost,
  TestAuthor,
  TestArticle,
  TestUserWithProfile,
  TestProfile,
  TestCourse,
  TestStudent,
} from "../../../__fixtures__/test-entities";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_qb_${randomBytes(6).toString("hex")}`;

  // Sync tables for the entities we need
  const metadatas = [
    TestUser,
    TestPost,
    TestAuthor,
    TestArticle,
    TestUserWithProfile,
    TestProfile,
    TestCourse,
    TestStudent,
  ].map((e) => getEntityMetadata(e));

  const desired = projectDesiredSchema(metadatas, { namespace: schema });
  const managedTables = desired.tables.map((t) => ({ schema: t.schema, name: t.name }));
  const snapshot = await introspectSchema(client, managedTables);
  const plan = diffSchema(snapshot, desired);
  await new SyncPlanExecutor(undefined, schema).execute(client, plan, {});
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

// Helpers
const insertUser = async (
  id: string,
  name: string,
  email: string | null,
  age: number,
) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestUser" ("id", "version", "createdAt", "updatedAt", "name", "email", "age")
     VALUES ($1, 1, NOW(), NOW(), $2, $3, $4)`,
    [id, name, email, age],
  );
};

const insertAuthor = async (id: string, name: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestAuthor" ("id", "version", "createdAt", "updatedAt", "name")
     VALUES ($1, 1, NOW(), NOW(), $2)`,
    [id, name],
  );
};

const insertArticle = async (id: string, title: string, authorId: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestArticle" ("id", "version", "createdAt", "updatedAt", "title", "authorId")
     VALUES ($1, 1, NOW(), NOW(), $2, $3)`,
    [id, title, authorId],
  );
};

const insertProfile = async (id: string, bio: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestProfile" ("id", "version", "createdAt", "updatedAt", "bio")
     VALUES ($1, 1, NOW(), NOW(), $2)`,
    [id, bio],
  );
};

const insertUserWithProfile = async (
  id: string,
  name: string,
  profileId: string | null,
) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestUserWithProfile" ("id", "version", "createdAt", "updatedAt", "name", "profileId")
     VALUES ($1, 1, NOW(), NOW(), $2, $3)`,
    [id, name, profileId],
  );
};

const insertCourse = async (id: string, name: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestCourse" ("id", "version", "createdAt", "updatedAt", "name")
     VALUES ($1, 1, NOW(), NOW(), $2)`,
    [id, name],
  );
};

const insertStudent = async (id: string, name: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."TestStudent" ("id", "version", "createdAt", "updatedAt", "name")
     VALUES ($1, 1, NOW(), NOW(), $2)`,
    [id, name],
  );
};

const insertCourseStudent = async (courseId: string, studentId: string) => {
  await raw.query(
    `INSERT INTO "${schema}"."test_course_x_test_student" ("testCourseId", "testStudentId")
     VALUES ($1, $2)`,
    [courseId, studentId],
  );
};

const createQB = <E>(entity: new (...args: any[]) => E) => {
  const metadata = getEntityMetadata(entity as any);
  return new PostgresQueryBuilder<any>(metadata, client, schema);
};

describe("PostgresQueryBuilder (integration)", () => {
  // Seed data
  const userId1 = randomUUID();
  const userId2 = randomUUID();
  const userId3 = randomUUID();

  const authorId1 = randomUUID();
  const authorId2 = randomUUID();

  const articleId1 = randomUUID();
  const articleId2 = randomUUID();
  const articleId3 = randomUUID();

  const profileId1 = randomUUID();
  const profileId2 = randomUUID();

  const uwpId1 = randomUUID();
  const uwpId2 = randomUUID();
  const uwpId3 = randomUUID();

  const courseId1 = randomUUID();
  const courseId2 = randomUUID();
  const studentId1 = randomUUID();
  const studentId2 = randomUUID();
  const studentId3 = randomUUID();

  beforeAll(async () => {
    // Users
    await insertUser(userId1, "Alice", "alice@test.com", 30);
    await insertUser(userId2, "Bob", null, 25);
    await insertUser(userId3, "Charlie", "charlie@test.com", 35);

    // Authors and articles (OneToMany / ManyToOne)
    await insertAuthor(authorId1, "Author One");
    await insertAuthor(authorId2, "Author Two");
    await insertArticle(articleId1, "First Article", authorId1);
    await insertArticle(articleId2, "Second Article", authorId1);
    await insertArticle(articleId3, "Third Article", authorId2);

    // Profiles and users with profiles (OneToOne)
    await insertProfile(profileId1, "Bio for user 1");
    await insertProfile(profileId2, "Bio for user 2");
    await insertUserWithProfile(uwpId1, "ProfileUser1", profileId1);
    await insertUserWithProfile(uwpId2, "ProfileUser2", profileId2);
    await insertUserWithProfile(uwpId3, "ProfileUser3", null);

    // Courses and students (ManyToMany)
    await insertCourse(courseId1, "Math 101");
    await insertCourse(courseId2, "Physics 201");
    await insertStudent(studentId1, "Student Alpha");
    await insertStudent(studentId2, "Student Beta");
    await insertStudent(studentId3, "Student Gamma");
    // Alpha enrolled in both courses, Beta in Math only, Gamma in Physics only
    await insertCourseStudent(courseId1, studentId1);
    await insertCourseStudent(courseId1, studentId2);
    await insertCourseStudent(courseId2, studentId1);
    await insertCourseStudent(courseId2, studentId3);
  });

  describe("basic queries", () => {
    test("getMany should return all rows", async () => {
      const result = await createQB(TestUser).getMany();
      expect(result).toHaveLength(3);
    });

    test("getOne should return single row", async () => {
      const result = await createQB(TestUser).where({ id: userId1 }).getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice");
      expect(result!.email).toBe("alice@test.com");
    });

    test("getOne should return null for no match", async () => {
      const result = await createQB(TestUser).where({ id: randomUUID() }).getOne();
      expect(result).toBeNull();
    });

    test("getOneOrFail should throw when not found", async () => {
      await expect(
        createQB(TestUser).where({ id: randomUUID() }).getOneOrFail(),
      ).rejects.toThrow(/Expected entity/);
    });

    test("count should return correct count", async () => {
      const count = await createQB(TestUser).count();
      expect(count).toBe(3);
    });

    test("exists should return true when match exists", async () => {
      const result = await createQB(TestUser).where({ name: "Alice" }).exists();
      expect(result).toBe(true);
    });

    test("exists should return false when no match", async () => {
      const result = await createQB(TestUser).where({ name: "Nobody" }).exists();
      expect(result).toBe(false);
    });

    test("getManyAndCount should return entities and total", async () => {
      const [entities, count] = await createQB(TestUser).take(2).getManyAndCount();
      expect(entities).toHaveLength(2);
      expect(count).toBe(3);
    });
  });

  describe("predicates", () => {
    test("$eq operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $eq: "Alice" } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    test("$neq operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $neq: "Alice" } })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("$gt and $lt operators", async () => {
      const result = await createQB(TestUser)
        .where({ age: { $gt: 25, $lt: 35 } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    test("$gte and $lte operators", async () => {
      const result = await createQB(TestUser)
        .where({ age: { $gte: 25, $lte: 35 } })
        .getMany();
      expect(result).toHaveLength(3);
    });

    test("$between operator", async () => {
      const result = await createQB(TestUser)
        .where({ age: { $between: [26, 34] } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    test("$in operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $in: ["Alice", "Charlie"] } })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("$in with empty array should return nothing", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $in: [] } })
        .getMany();
      expect(result).toHaveLength(0);
    });

    test("$nin operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $nin: ["Alice", "Charlie"] } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });

    test("$like operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $like: "Ali%" } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    test("$ilike operator", async () => {
      const result = await createQB(TestUser)
        .where({ name: { $ilike: "ali%" } })
        .getMany();
      expect(result).toHaveLength(1);
    });

    test("$exists true (IS NOT NULL)", async () => {
      const result = await createQB(TestUser)
        .where({ email: { $exists: true } })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("$exists false (IS NULL)", async () => {
      const result = await createQB(TestUser)
        .where({ email: { $exists: false } })
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });

    test("null equality", async () => {
      const result = await createQB(TestUser).where({ email: null }).getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
    });
  });

  describe("logical operators", () => {
    test("$or", async () => {
      const result = await createQB(TestUser)
        .where({ $or: [{ name: "Alice" }, { name: "Bob" }] })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("$and", async () => {
      const result = await createQB(TestUser)
        .where({ $and: [{ age: { $gte: 30 } }, { email: { $exists: true } }] })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("$not", async () => {
      const result = await createQB(TestUser)
        .where({ $not: { name: "Alice" } })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("andWhere adds AND conjunction", async () => {
      const result = await createQB(TestUser)
        .where({ age: { $gte: 25 } })
        .andWhere({ email: { $exists: true } })
        .getMany();
      expect(result).toHaveLength(2);
    });

    test("orWhere adds OR conjunction", async () => {
      const result = await createQB(TestUser)
        .where({ name: "Alice" })
        .orWhere({ name: "Bob" })
        .getMany();
      expect(result).toHaveLength(2);
    });
  });

  describe("ordering and pagination", () => {
    test("orderBy ASC", async () => {
      const result = await createQB(TestUser).orderBy({ age: "ASC" }).getMany();
      expect(result[0].name).toBe("Bob");
      expect(result[2].name).toBe("Charlie");
    });

    test("orderBy DESC", async () => {
      const result = await createQB(TestUser).orderBy({ age: "DESC" }).getMany();
      expect(result[0].name).toBe("Charlie");
      expect(result[2].name).toBe("Bob");
    });

    test("skip and take", async () => {
      const result = await createQB(TestUser)
        .orderBy({ age: "ASC" })
        .skip(1)
        .take(1)
        .getMany();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
    });

    test("take only", async () => {
      const result = await createQB(TestUser).orderBy({ name: "ASC" }).take(2).getMany();
      expect(result).toHaveLength(2);
    });
  });

  describe("select", () => {
    test("should return only selected fields", async () => {
      const result = await createQB(TestUser)
        .where({ id: userId1 })
        .select("id", "name")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.id).toBe(userId1);
      expect(result!.name).toBe("Alice");
      // Non-selected fields are null (hydrator maps all metadata fields)
      expect(result!.email).toBeNull();
      expect(result!.age).toBeNull();
    });
  });

  describe("include (JOIN)", () => {
    test("ManyToOne: articles include author", async () => {
      const result = await createQB(TestArticle)
        .where({ id: articleId1 })
        .include("author")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.title).toBe("First Article");
      expect(result!.author).toBeDefined();
      expect(result!.author.name).toBe("Author One");
    });

    test("OneToOne owning: user includes profile", async () => {
      const result = await createQB(TestUserWithProfile)
        .where({ id: uwpId1 })
        .include("profile")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("ProfileUser1");
      expect(result!.profile).toBeDefined();
      expect(result!.profile.bio).toBe("Bio for user 1");
    });

    test("LEFT JOIN: user without profile still returned", async () => {
      const result = await createQB(TestUserWithProfile)
        .where({ id: uwpId3 })
        .include("profile")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("ProfileUser3");
      expect(result!.profile).toBeNull();
    });

    test("INNER JOIN: user without profile excluded", async () => {
      const result = await createQB(TestUserWithProfile)
        .include("profile", { required: true })
        .getMany();
      // uwpId3 has no profile, should be excluded
      expect(result).toHaveLength(2);
      expect(result.every((u: any) => u.profile !== null)).toBe(true);
    });
  });

  describe("include with where (filtered JOIN)", () => {
    test("should filter joined rows via ON clause", async () => {
      const result = await createQB(TestAuthor)
        .where({ id: authorId1 })
        .include("articles", { where: { title: "First Article" } })
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Author One");
      // Only the matching article should be included
      expect(result!.articles).toHaveLength(1);
      expect(result!.articles[0].title).toBe("First Article");
    });

    test("LEFT JOIN with where: author with no matching articles still returned", async () => {
      const result = await createQB(TestAuthor)
        .where({ id: authorId2 })
        .include("articles", { where: { title: "Nonexistent" } })
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Author Two");
      expect(result!.articles).toHaveLength(0);
    });

    test("INNER JOIN with where: author excluded when no matching articles", async () => {
      const result = await createQB(TestAuthor)
        .include("articles", { required: true, where: { title: "Nonexistent" } })
        .getMany();
      expect(result).toHaveLength(0);
    });
  });

  describe("ManyToMany include", () => {
    test("should load M2M related entities", async () => {
      const result = await createQB(TestCourse)
        .where({ id: courseId1 })
        .include("students")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Math 101");
      expect(result!.students).toHaveLength(2);
      const names = result!.students.map((s: any) => s.name).sort();
      expect(names).toEqual(["Student Alpha", "Student Beta"]);
    });

    test("should load M2M from inverse side", async () => {
      const result = await createQB(TestStudent)
        .where({ id: studentId1 })
        .include("courses")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Student Alpha");
      expect(result!.courses).toHaveLength(2);
      const names = result!.courses.map((c: any) => c.name).sort();
      expect(names).toEqual(["Math 101", "Physics 201"]);
    });

    test("should return empty array for entity with no M2M relations", async () => {
      // Create a student with no courses
      const loneId = randomUUID();
      await insertStudent(loneId, "Lone Student");
      const result = await createQB(TestStudent)
        .where({ id: loneId })
        .include("courses")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.courses).toHaveLength(0);
    });

    test("M2M count should be correct (not inflated by JOINs)", async () => {
      const count = await createQB(TestCourse).include("students").count();
      expect(count).toBe(2);
    });

    test("getManyAndCount with M2M should return correct count", async () => {
      const [entities, count] = await createQB(TestCourse)
        .include("students")
        .getManyAndCount();
      expect(entities).toHaveLength(2);
      expect(count).toBe(2);
    });
  });

  describe("OneToMany getOne", () => {
    test("getOne with OneToMany should return all children", async () => {
      const result = await createQB(TestAuthor)
        .where({ id: authorId1 })
        .include("articles")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Author One");
      // Author One has 2 articles — getOne should not truncate the collection
      expect(result!.articles).toHaveLength(2);
    });
  });

  describe("lock", () => {
    test("FOR UPDATE should not error", async () => {
      const result = await createQB(TestUser)
        .where({ id: userId1 })
        .lock("pessimistic_write")
        .getOne();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice");
    });
  });

  describe("toSQL", () => {
    test("should return parameterized query", () => {
      const qb = createQB(TestUser)
        .where({ name: "Alice", age: { $gte: 18 } })
        .orderBy({ name: "ASC" })
        .take(10);
      const sql = qb.toSQL();
      expect(sql.text).toContain("SELECT");
      expect(sql.text).toContain("WHERE");
      expect(sql.text).toContain("ORDER BY");
      expect(sql.text).toContain("LIMIT");
      expect(sql.params).toEqual(["Alice", 18, 10]);
    });
  });

  describe("clone", () => {
    test("cloned builder should be independent", async () => {
      const base = createQB(TestUser).orderBy({ age: "ASC" });
      const page1 = await (base.clone() as PostgresQueryBuilder<any>).take(1).getMany();
      const page2 = await (base.clone() as PostgresQueryBuilder<any>)
        .skip(1)
        .take(1)
        .getMany();

      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0].name).not.toBe(page2[0].name);
    });
  });
});

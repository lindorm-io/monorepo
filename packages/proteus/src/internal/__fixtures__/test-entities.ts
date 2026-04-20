import { vi } from "vitest";
import { z } from "zod";
import {
  AfterDestroy,
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  BeforeDestroy,
  BeforeInsert,
  BeforeUpdate,
  Check,
  CreateDateField,
  Default,
  DeleteDateField,
  Eager,
  Entity,
  ExpiryDateField,
  Field,
  Generated,
  Index,
  JoinKey,
  JoinTable,
  ManyToMany,
  ManyToOne,
  Nullable,
  OnCreate,
  OneToMany,
  OneToOne,
  OnValidate,
  PrimaryKey,
  PrimaryKeyField,
  Schema,
  ScopeField,
  Unique,
  UpdateDateField,
  VersionField,
  VersionKeyField,
} from "../../decorators";

// ─────────────────────────────────────────────────────────────────────────────
// Simple entity with a UUID primary key
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestUser" })
export class TestUser {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("string")
  email!: string | null;

  @Default(0)
  @Field("integer")
  age!: number;

  @OneToMany(() => TestPost, "author")
  posts!: TestPost[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with integer primary key (increment)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestPost" })
export class TestPost {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @Nullable()
  @Field("string")
  body!: string | null;

  // ManyToOne back-reference
  @ManyToOne(() => TestUser, "posts")
  author!: TestUser | null;

  authorId!: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with scope field
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestScopedEntity" })
export class TestScopedEntity {
  @PrimaryKeyField()
  id!: string;

  @ScopeField()
  scope!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with soft-delete and expiry
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestSoftDelete" })
export class TestSoftDelete {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @DeleteDateField()
  deletedAt!: Date | null;

  @ExpiryDateField()
  expiresAt!: Date | null;

  @Field("string")
  name!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with hooks and schema
// ─────────────────────────────────────────────────────────────────────────────

const testHookCallback = vi.fn();

@Entity({ name: "TestWithHooks" })
@OnCreate(testHookCallback)
@BeforeInsert(testHookCallback)
@BeforeUpdate(testHookCallback)
@BeforeDestroy(testHookCallback)
@AfterInsert(testHookCallback)
@AfterUpdate(testHookCallback)
@AfterDestroy(testHookCallback)
@AfterLoad(testHookCallback)
@OnValidate(testHookCallback)
export class TestWithHooks {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with Schema
// ─────────────────────────────────────────────────────────────────────────────

const testSchema = z.object({
  name: z.string().min(1),
});

@Entity({ name: "TestWithSchema" })
@Schema(testSchema)
export class TestWithSchema {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relations: Profile (OneToOne, owning side with joinKey)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestProfile" })
export class TestProfile {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  bio!: string;

  // Inverse side (no joinKey)
  @Eager()
  @OneToOne(() => TestUserWithProfile, "profile")
  user!: TestUserWithProfile | null;
}

@Entity({ name: "TestUserWithProfile" })
export class TestUserWithProfile {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  // Owning side (@JoinKey)
  @Eager()
  @JoinKey()
  @OneToOne(() => TestProfile, "user")
  profile!: TestProfile | null;

  @Nullable()
  @Field("uuid")
  profileId!: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relations: Author (OneToMany), Article (ManyToOne)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestArticle" })
export class TestArticle {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @Eager()
  @ManyToOne(() => TestAuthor, "articles")
  author!: TestAuthor | null;

  authorId!: string | null;
}

@Entity({ name: "TestAuthor" })
export class TestAuthor {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Eager()
  @OneToMany(() => TestArticle, "author")
  articles!: TestArticle[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Relations: ManyToMany (Student <-> Course)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestCourse" })
export class TestCourse {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => TestStudent, "courses")
  students!: TestStudent[];
}

@Entity({ name: "TestStudent" })
export class TestStudent {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @ManyToMany(() => TestCourse, "students")
  courses!: TestCourse[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with check constraints
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestChecked" })
@Check("age >= 0", { name: "age_positive" })
@Check("score BETWEEN 0 AND 100")
export class TestChecked {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("integer")
  age!: number;

  @Field("float")
  score!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with index and unique constraints
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestIndexed" })
@Index<typeof TestIndexed>(["email", "name"])
@Unique<typeof TestIndexed>(["email"], { name: "unique_email" })
export class TestIndexed {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Index("asc", { name: "idx_name" })
  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity with VersionKey (composite PK with version)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "TestVersionKeyed" })
export class TestVersionKeyed {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  versionId!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

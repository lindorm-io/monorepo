// TCK Entity Factory
//
// Each call produces fresh class declarations with fresh Symbol.metadata.

import {
  AfterDestroy,
  AfterInsert,
  AfterLoad,
  AfterSave,
  AfterUpdate,
  BeforeDestroy,
  BeforeInsert,
  BeforeSave,
  BeforeUpdate,
  Cascade,
  CreateDateField,
  Default,
  DeleteDateField,
  Discriminator,
  DiscriminatorValue,
  Eager,
  Embeddable,
  Embedded,
  Encrypted,
  Entity,
  ExpiryDateField,
  Field,
  Generated,
  Inheritance,
  JoinKey,
  JoinTable,
  Lazy,
  ManyToMany,
  ManyToOne,
  Nullable,
  OneToMany,
  OneToOne,
  OnCreate,
  OnOrphan,
  OnValidate,
  PrimaryKey,
  PrimaryKeyField,
  ScopeField,
  Transform,
  Unique,
  UpdateDateField,
  VersionField,
  VersionKeyField,
  VersionStartDateField,
  VersionEndDateField,
} from "../../../decorators";

export type TckEntities = ReturnType<typeof createTckEntities>;

export const createTckEntities = (hookCallback: jest.Mock) => {
  // Forward-declare relation classes so thunks can reference them

  @Entity({ name: "TckSimplePost" })
  class TckSimplePost {
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

    @Nullable()
    @Field("string")
    body!: string | null;

    @Eager()
    @ManyToOne(() => TckSimpleUser, "posts")
    author!: TckSimpleUser | null;

    @Nullable()
    @Field("uuid")
    authorId!: string | null;
  }

  @Entity({ name: "TckSimpleUser" })
  class TckSimpleUser {
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

    @Eager()
    @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
    @OneToMany(() => TckSimplePost, "author")
    posts!: TckSimplePost[];
  }

  @Entity({ name: "TckSoftDeletable" })
  class TckSoftDeletable {
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

    @Field("string")
    name!: string;

    @Default(0)
    @Field("integer")
    score!: number;
  }

  @Entity({ name: "TckExpirable" })
  class TckExpirable {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @ExpiryDateField()
    expiresAt!: Date | null;

    @Field("string")
    name!: string;
  }

  @Entity({ name: "TckVersionKeyed" })
  class TckVersionKeyed {
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

    @VersionStartDateField()
    versionStart!: Date;

    @VersionEndDateField()
    versionEnd!: Date | null;

    @Field("string")
    name!: string;
  }

  // OneToOne: TckOwner (owning side, has join key) <-> TckDetail (inverse side)

  @Entity({ name: "TckDetail" })
  class TckDetail {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    info!: string;

    @Eager()
    @OneToOne(() => TckOwner, "detail")
    owner!: TckOwner | null;
  }

  @Entity({ name: "TckOwner" })
  class TckOwner {
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
    @Cascade({ onInsert: "cascade" })
    @JoinKey()
    @OneToOne(() => TckDetail, "owner")
    detail!: TckDetail | null;

    @Nullable()
    @Field("uuid")
    detailId!: string | null;
  }

  // ManyToMany: TckLeft (has join table) <-> TckRight

  @Entity({ name: "TckRight" })
  class TckRight {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    label!: string;

    @Eager()
    @ManyToMany(() => TckLeft, "rights")
    lefts!: TckLeft[];
  }

  @Entity({ name: "TckLeft" })
  class TckLeft {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    label!: string;

    @Eager()
    @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
    @JoinTable()
    @ManyToMany(() => TckRight, "lefts")
    rights!: TckRight[];
  }

  // ─── Lazy Loading Entities ──────────────────────────────────────────

  @Entity({ name: "TckLazyPost" })
  class TckLazyPost {
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

    @Lazy()
    @ManyToOne(() => TckLazyUser, "posts")
    author!: TckLazyUser | null;

    @Nullable()
    @Field("uuid")
    authorId!: string | null;
  }

  @Entity({ name: "TckLazyUser" })
  class TckLazyUser {
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

    @Lazy()
    @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
    @OneToMany(() => TckLazyPost, "author")
    posts!: TckLazyPost[];
  }

  @Entity({ name: "TckLazyDetail" })
  class TckLazyDetail {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    info!: string;

    @Lazy()
    @OneToOne(() => TckLazyOwner, "detail")
    owner!: TckLazyOwner | null;
  }

  @Entity({ name: "TckLazyOwner" })
  class TckLazyOwner {
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

    @Lazy()
    @Cascade({ onInsert: "cascade" })
    @JoinKey()
    @OneToOne(() => TckLazyDetail, "owner")
    detail!: TckLazyDetail | null;

    @Nullable()
    @Field("uuid")
    detailId!: string | null;
  }

  @Entity({ name: "TckLazyRight" })
  class TckLazyRight {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    label!: string;

    @Lazy()
    @ManyToMany(() => TckLazyLeft, "rights")
    lefts!: TckLazyLeft[];
  }

  @Entity({ name: "TckLazyLeft" })
  class TckLazyLeft {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    label!: string;

    @Lazy()
    @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
    @JoinTable()
    @ManyToMany(() => TckLazyRight, "lefts")
    rights!: TckLazyRight[];
  }

  @Entity({ name: "TckHooked" })
  @OnCreate(hookCallback)
  @OnValidate(hookCallback)
  @BeforeInsert(hookCallback)
  @BeforeSave(hookCallback)
  @BeforeUpdate(hookCallback)
  @BeforeDestroy(hookCallback)
  @AfterInsert(hookCallback)
  @AfterSave(hookCallback)
  @AfterUpdate(hookCallback)
  @AfterDestroy(hookCallback)
  @AfterLoad(hookCallback)
  class TckHooked {
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

  @Entity({ name: "TckScoped" })
  class TckScoped {
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

  @Entity({ name: "TckUnversioned" })
  class TckUnversioned {
    @PrimaryKeyField()
    id!: string;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    name!: string;

    @Default(0)
    @Field("integer")
    score!: number;
  }

  @Entity({ name: "TckUniqueConstrained" })
  class TckUniqueConstrained {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Unique()
    @Field("string")
    email!: string;

    @Field("string")
    name!: string;
  }

  // ─── Foreign Key Constraint Entities ────────────────────────────────

  @Entity({ name: "TckFkParent" })
  class TckFkParent {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") name!: string;

    @OneToMany(() => TckFkCascadeChild, "parent")
    cascadeChildren!: TckFkCascadeChild[];

    @OneToMany(() => TckFkRestrictChild, "parent")
    restrictChildren!: TckFkRestrictChild[];

    @OneToMany(() => TckFkNullifyChild, "parent")
    nullifyChildren!: TckFkNullifyChild[];
  }

  @Entity({ name: "TckFkCascadeChild" })
  class TckFkCascadeChild {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") value!: string;

    @Cascade({ onDestroy: "cascade" })
    @ManyToOne(() => TckFkParent, "cascadeChildren")
    parent!: TckFkParent;
    parentId!: string;
  }

  @Entity({ name: "TckFkRestrictChild" })
  class TckFkRestrictChild {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") value!: string;

    @Cascade({ onDestroy: "restrict" })
    @ManyToOne(() => TckFkParent, "restrictChildren")
    parent!: TckFkParent;
    parentId!: string;
  }

  @Entity({ name: "TckFkNullifyChild" })
  class TckFkNullifyChild {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") value!: string;

    @Cascade({ onDestroy: "set_null" })
    @ManyToOne(() => TckFkParent, "nullifyChildren")
    parent!: TckFkParent | null;

    @Nullable()
    @Field("uuid")
    parentId!: string | null;
  }

  @Entity({ name: "TckUniqueComposite" })
  @Unique<typeof TckUniqueComposite>(["tenantId", "key"])
  class TckUniqueComposite {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    tenantId!: string;

    @Field("string")
    key!: string;

    @Field("integer")
    value!: number;
  }

  // ─── ORM-Level Cascade/Orphan Entities ──────────────────────────────

  @Entity({ name: "TckCascadeParent" })
  class TckCascadeParent {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") name!: string;

    @Eager()
    @Cascade({ onInsert: "cascade", onUpdate: "cascade", onDestroy: "cascade" })
    @OnOrphan("delete")
    @OneToMany(() => TckCascadeChild, "parent")
    children!: TckCascadeChild[];
  }

  @Entity({ name: "TckCascadeChild" })
  class TckCascadeChild {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") label!: string;

    @Eager()
    @ManyToOne(() => TckCascadeParent, "children")
    parent!: TckCascadeParent | null;

    @Nullable()
    @Field("uuid")
    parentId!: string | null;
  }

  // ─── Scoped Loading Entities ────────────────────────────────────────

  @Entity({ name: "TckScopedPost" })
  class TckScopedPost {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") title!: string;

    @Eager("single")
    @Lazy("multiple")
    @ManyToOne(() => TckScopedUser, "posts")
    author!: TckScopedUser | null;

    @Nullable()
    @Field("uuid")
    authorId!: string | null;
  }

  @Entity({ name: "TckScopedUser" })
  class TckScopedUser {
    @PrimaryKeyField() id!: string;
    @VersionField() version!: number;
    @CreateDateField() createdAt!: Date;
    @UpdateDateField() updatedAt!: Date;
    @Field("string") name!: string;

    @Eager("single")
    @Lazy("multiple")
    @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
    @OneToMany(() => TckScopedPost, "author")
    posts!: TckScopedPost[];
  }

  // ─── Single-Table Inheritance Entities ─────────────────────────────

  @Inheritance("single-table")
  @Discriminator("type")
  @Entity({ name: "TckVehicle" })
  class TckVehicle {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @Field("string")
    type!: string;

    @Field("string")
    make!: string;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;
  }

  @Entity({ name: "TckCar" })
  @DiscriminatorValue("car")
  class TckCar extends TckVehicle {
    @Nullable()
    @Field("integer")
    seatCount!: number | null;
  }

  @Entity({ name: "TckTruck" })
  @DiscriminatorValue("truck")
  class TckTruck extends TckVehicle {
    @Nullable()
    @Field("float")
    payloadCapacity!: number | null;
  }

  // ─── Joined Inheritance Entities ──────────────────────────────────

  @Inheritance("joined")
  @Discriminator("kind")
  @Entity({ name: "TckAnimal" })
  class TckAnimal {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @Field("string")
    kind!: string;

    @Field("string")
    name!: string;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;
  }

  @Entity({ name: "TckDog" })
  @DiscriminatorValue("dog")
  class TckDog extends TckAnimal {
    @Field("string")
    breed!: string;
  }

  @Entity({ name: "TckCat" })
  @DiscriminatorValue("cat")
  class TckCat extends TckAnimal {
    @Field("boolean")
    isIndoor!: boolean;
  }

  // ─── Complex Predicate Test Entities ──────────────────────────────

  @Entity({ name: "TckArrayHolder" })
  class TckArrayHolder {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("array", { arrayType: "string" })
    tags!: string[];

    @Field("array", { arrayType: "integer" })
    scores!: number[];

    @Nullable()
    @Field("array", { arrayType: "string" })
    extras!: string[] | null;

    @Default(() => [])
    @Field("array", { arrayType: "string" })
    labels!: string[];
  }

  @Entity({ name: "TckJsonHolder" })
  class TckJsonHolder {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("json")
    metadata!: Record<string, unknown>;

    @Field("object")
    settings!: { theme: string; count: number };

    @Field("json")
    payload!: { items: string[]; count: number };
  }

  @Embeddable()
  class TckAddress {
    @Field("string") street!: string;
    @Field("string") city!: string;
    @Field("string") country!: string;
  }

  @Entity({ name: "TckWithAddress" })
  class TckWithAddress {
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

    @Embedded(() => TckAddress)
    address!: TckAddress | null;
  }

  // ─── Encryption Test Entities ──────────────────────────────────────
  const toUpperCase = (value: unknown) => (value as string).toUpperCase();
  const toLowerCase = (raw: unknown) => (raw as string).toLowerCase();

  @Entity({ name: "TckEncrypted" })
  class TckEncrypted {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Encrypted()
    @Field("string")
    secret!: string;

    @Encrypted()
    @Field("integer")
    pin!: number;

    @Encrypted()
    @Field("boolean")
    verified!: boolean;

    @Encrypted()
    @Field("json")
    metadata!: Record<string, unknown>;

    @Nullable()
    @Encrypted()
    @Field("string")
    optionalSecret!: string | null;

    @Transform({ to: toUpperCase, from: toLowerCase })
    @Encrypted()
    @Field("string")
    transformedSecret!: string;
  }

  return {
    TckSimpleUser,
    TckSimplePost,
    TckSoftDeletable,
    TckExpirable,
    TckVersionKeyed,
    TckOwner,
    TckDetail,
    TckLeft,
    TckRight,
    TckLazyUser,
    TckLazyPost,
    TckLazyOwner,
    TckLazyDetail,
    TckLazyLeft,
    TckLazyRight,
    TckScopedUser,
    TckScopedPost,
    TckHooked,
    TckScoped,
    TckUnversioned,
    TckUniqueConstrained,
    TckUniqueComposite,
    TckFkParent,
    TckFkCascadeChild,
    TckFkRestrictChild,
    TckFkNullifyChild,
    TckCascadeParent,
    TckCascadeChild,
    TckVehicle,
    TckCar,
    TckTruck,
    TckAnimal,
    TckDog,
    TckCat,
    TckArrayHolder,
    TckJsonHolder,
    TckAddress,
    TckWithAddress,
    TckEncrypted,
  };
};

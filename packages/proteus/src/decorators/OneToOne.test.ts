import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Eager } from "./Eager";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { Nullable } from "./Nullable";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { OneToOne } from "./OneToOne";

// OneToOne: User owns Profile (has FK), Profile references back to User

@Entity({ name: "OneToOneProfile" })
class OneToOneProfile {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  bio!: string;

  // Inverse side
  @Eager()
  @OneToOne(() => OneToOneUser, "profile")
  user!: OneToOneUser | null;
}

@Entity({ name: "OneToOneUser" })
class OneToOneUser {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  // Owning side (has FK column: profileId)
  @Eager()
  @JoinKey()
  @OneToOne(() => OneToOneProfile, "user")
  profile!: OneToOneProfile | null;

  profileId!: string | null;
}

// OneToOne with explicit joinKeys
@Entity({ name: "OneToOneExplicitProfile" })
class OneToOneExplicitProfile {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  bio!: string;

  // Inverse
  @OneToOne(() => OneToOneExplicitUser, "profile")
  user!: OneToOneExplicitUser | null;
}

@Entity({ name: "OneToOneExplicitUser" })
class OneToOneExplicitUser {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("uuid")
  profileId!: string | null;

  // Owning side with explicit joinKeys
  @JoinKey({ profileId: "id" })
  @OneToOne(() => OneToOneExplicitProfile, "user")
  profile!: OneToOneExplicitProfile | null;
}

describe("OneToOne", () => {
  test("should register owning side with @JoinKey", () => {
    expect(getEntityMetadata(OneToOneUser)).toMatchSnapshot();
  });

  test("should register inverse side", () => {
    expect(getEntityMetadata(OneToOneProfile)).toMatchSnapshot();
  });

  test("should resolve joinKeys and findKeys for owning side", () => {
    const meta = getEntityMetadata(OneToOneUser);
    const rel = meta.relations.find((r) => r.key === "profile")!;

    expect(rel.joinKeys).toEqual({ profileId: "id" });
    expect(rel.findKeys).toEqual({ id: "profileId" });
  });

  test("should resolve findKeys for inverse side with null joinKeys", () => {
    const meta = getEntityMetadata(OneToOneProfile);
    const rel = meta.relations.find((r) => r.key === "user")!;

    expect(rel.joinKeys).toBeNull();
    expect(rel.findKeys).toEqual({ profileId: "id" });
  });

  test("should register with explicit joinKeys", () => {
    expect(getEntityMetadata(OneToOneExplicitUser)).toMatchSnapshot();
  });
});

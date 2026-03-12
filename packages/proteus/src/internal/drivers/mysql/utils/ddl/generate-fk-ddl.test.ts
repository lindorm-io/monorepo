import { Cascade } from "../../../../../decorators/Cascade";
import { Entity } from "../../../../../decorators/Entity";
import { Field } from "../../../../../decorators/Field";
import { JoinKey } from "../../../../../decorators/JoinKey";
import { ManyToOne } from "../../../../../decorators/ManyToOne";
import { OneToMany } from "../../../../../decorators/OneToMany";
import { OneToOne } from "../../../../../decorators/OneToOne";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { generateFkDDL } from "./generate-fk-ddl";

// ---------------------------------------------------------------------------
// Test entities
// ---------------------------------------------------------------------------

@Entity({ name: "MysFkDefaultChild" })
class MysFkDefaultChild {
  @PrimaryKeyField()
  id!: string;

  @ManyToOne(() => MysFkDefaultParent, "children")
  parent!: MysFkDefaultParent | null;

  parentId!: string | null;
}

@Entity({ name: "MysFkDefaultParent" })
class MysFkDefaultParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => MysFkDefaultChild, "parent")
  children!: MysFkDefaultChild[];
}

@Entity({ name: "MysFkCascadeChild" })
class MysFkCascadeChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "cascade", onUpdate: "cascade" })
  @ManyToOne(() => MysFkCascadeParent, "children")
  parent!: MysFkCascadeParent | null;

  parentId!: string | null;
}

@Entity({ name: "MysFkCascadeParent" })
class MysFkCascadeParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => MysFkCascadeChild, "parent")
  children!: MysFkCascadeChild[];
}

@Entity({ name: "MysFkSetNullChild" })
class MysFkSetNullChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "set_null", onUpdate: "set_null" })
  @ManyToOne(() => MysFkSetNullParent, "children")
  parent!: MysFkSetNullParent | null;

  parentId!: string | null;
}

@Entity({ name: "MysFkSetNullParent" })
class MysFkSetNullParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => MysFkSetNullChild, "parent")
  children!: MysFkSetNullChild[];
}

@Entity({ name: "MysFkOneToOneProfile" })
class MysFkOneToOneProfile {
  @PrimaryKeyField()
  id!: string;

  @OneToOne(() => MysFkOneToOneUser, "profile")
  user!: MysFkOneToOneUser | null;
}

@Entity({ name: "MysFkOneToOneUser" })
class MysFkOneToOneUser {
  @PrimaryKeyField()
  id!: string;

  @JoinKey()
  @OneToOne(() => MysFkOneToOneProfile, "user")
  profile!: MysFkOneToOneProfile | null;

  profileId!: string | null;
}

@Entity({ name: "MysFkNoRelations" })
class MysFkNoRelations {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("generateFkDDL (MySQL)", () => {
  test("returns empty array for entity with no relations", () => {
    const meta = getEntityMetadata(MysFkNoRelations);
    expect(generateFkDDL(meta)).toEqual([]);
  });

  test("generates FK constraint with default ON DELETE NO ACTION ON UPDATE NO ACTION", () => {
    const meta = getEntityMetadata(MysFkDefaultChild);
    expect(generateFkDDL(meta)).toMatchSnapshot();
  });

  test("generates FK constraint with ON DELETE CASCADE ON UPDATE CASCADE", () => {
    const meta = getEntityMetadata(MysFkCascadeChild);
    expect(generateFkDDL(meta)).toMatchSnapshot();
  });

  test("generates FK constraint with ON DELETE SET NULL ON UPDATE SET NULL", () => {
    const meta = getEntityMetadata(MysFkSetNullChild);
    const result = generateFkDDL(meta);
    expect(result[0]).toContain("ON DELETE SET NULL");
    expect(result[0]).toContain("ON UPDATE SET NULL");
    expect(result).toMatchSnapshot();
  });

  test("generates FK constraint for OneToOne owning side", () => {
    const meta = getEntityMetadata(MysFkOneToOneUser);
    expect(generateFkDDL(meta)).toMatchSnapshot();
  });

  test("returns empty array for inverse-side entity", () => {
    const meta = getEntityMetadata(MysFkDefaultParent);
    expect(generateFkDDL(meta)).toEqual([]);
  });

  test("returns empty array for inverse OneToOne entity", () => {
    const meta = getEntityMetadata(MysFkOneToOneProfile);
    expect(generateFkDDL(meta)).toEqual([]);
  });

  test("constraint name starts with fk_ and uses hash", () => {
    const meta = getEntityMetadata(MysFkDefaultChild);
    const result = generateFkDDL(meta);
    expect(result[0]).toMatch(/CONSTRAINT `fk_[A-Za-z0-9_-]{11}`/);
  });

  test("no DEFERRABLE clause (MySQL does not support it)", () => {
    const meta = getEntityMetadata(MysFkDefaultChild);
    const result = generateFkDDL(meta);
    expect(result[0]).not.toContain("DEFERRABLE");
  });
});

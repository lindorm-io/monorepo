import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { Lazy } from "./Lazy";
import { ManyToOne } from "./ManyToOne";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "LazyOrganization" })
class LazyOrganization {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => LazyMember, "organization")
  members!: LazyMember[];

  @OneToMany(() => LazySingleMember, "organization")
  singleMembers!: LazySingleMember[];

  @OneToMany(() => LazyMultipleMember, "organization")
  multipleMembers!: LazyMultipleMember[];
}

@Entity({ name: "LazyMember" })
class LazyMember {
  @PrimaryKeyField()
  id!: string;

  @Lazy()
  @JoinKey()
  @ManyToOne(() => LazyOrganization, "members")
  organization!: LazyOrganization | null;

  organizationId!: string | null;
}

@Entity({ name: "LazySingleMember" })
class LazySingleMember {
  @PrimaryKeyField()
  id!: string;

  @Lazy("single")
  @JoinKey()
  @ManyToOne(() => LazyOrganization, "singleMembers")
  organization!: LazyOrganization | null;

  organizationId!: string | null;
}

@Entity({ name: "LazyMultipleMember" })
class LazyMultipleMember {
  @PrimaryKeyField()
  id!: string;

  @Lazy("multiple")
  @JoinKey()
  @ManyToOne(() => LazyOrganization, "multipleMembers")
  organization!: LazyOrganization | null;

  organizationId!: string | null;
}

describe("Lazy", () => {
  test("should set loading to lazy for both scopes when no scope provided", () => {
    const meta = getEntityMetadata(LazyMember);
    const rel = meta.relations.find((r) => r.key === "organization")!;
    expect(rel.options.loading.single).toBe("lazy");
    expect(rel.options.loading.multiple).toBe("lazy");
  });

  test("should set loading to lazy for single scope only", () => {
    const meta = getEntityMetadata(LazySingleMember);
    const rel = meta.relations.find((r) => r.key === "organization")!;
    expect(rel.options.loading.single).toBe("lazy");
    expect(rel.options.loading.multiple).toBe("ignore");
  });

  test("should set loading to lazy for multiple scope only", () => {
    const meta = getEntityMetadata(LazyMultipleMember);
    const rel = meta.relations.find((r) => r.key === "organization")!;
    expect(rel.options.loading.single).toBe("ignore");
    expect(rel.options.loading.multiple).toBe("lazy");
  });

  test("should match snapshot for lazy on both scopes", () => {
    expect(getEntityMetadata(LazyMember)).toMatchSnapshot();
  });
});

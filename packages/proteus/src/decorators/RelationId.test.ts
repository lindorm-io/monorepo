import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { ManyToOne } from "./ManyToOne";
import { Nullable } from "./Nullable";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { RelationId } from "./RelationId";

@Entity({ name: "RelationIdCompany" })
class RelationIdCompany {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => RelationIdEmployee, "company")
  employees!: RelationIdEmployee[];

  @OneToMany(() => RelationIdExplicitEmployee, "company")
  explicitEmployees!: RelationIdExplicitEmployee[];
}

@Entity({ name: "RelationIdEmployee" })
class RelationIdEmployee {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @RelationId<RelationIdEmployee>("company")
  @Field("uuid")
  companyId!: string;

  @JoinKey()
  @ManyToOne(() => RelationIdCompany, "employees")
  company!: RelationIdCompany | null;
}

@Entity({ name: "RelationIdExplicitEmployee" })
class RelationIdExplicitEmployee {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("uuid")
  companyId!: string | null;

  @RelationId<RelationIdExplicitEmployee>("company", { column: "companyId" })
  @Field("uuid")
  explicitCompanyId!: string;

  @JoinKey({ companyId: "id" })
  @ManyToOne(() => RelationIdCompany, "explicitEmployees")
  company!: RelationIdCompany | null;
}

describe("RelationId", () => {
  test("should stage relationId entry with correct key and relationKey", () => {
    const meta = getEntityMetadata(RelationIdEmployee);
    const ri = meta.relationIds.find((r) => r.key === "companyId");
    expect(ri).toBeDefined();
    expect(ri!.key).toBe("companyId");
    expect(ri!.relationKey).toBe("company");
    expect(ri!.column).toBeNull();
  });

  test("should stage relationId entry with explicit column option", () => {
    const meta = getEntityMetadata(RelationIdExplicitEmployee);
    const ri = meta.relationIds.find((r) => r.key === "explicitCompanyId");
    expect(ri).toBeDefined();
    expect(ri!.column).toBe("companyId");
    expect(ri!.relationKey).toBe("company");
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(RelationIdEmployee)).toMatchSnapshot();
  });
});

import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { ManyToOne } from "./ManyToOne";
import { Nullable } from "./Nullable";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "JoinKeyDepartment" })
class JoinKeyDepartment {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => JoinKeyEmployee, "department")
  employees!: JoinKeyEmployee[];

  @OneToMany(() => JoinKeyExplicitEmployee, "department")
  explicitEmployees!: JoinKeyExplicitEmployee[];
}

// Auto-calculated join key
@Entity({ name: "JoinKeyEmployee" })
class JoinKeyEmployee {
  @PrimaryKeyField()
  id!: string;

  @JoinKey()
  @ManyToOne(() => JoinKeyDepartment, "employees")
  department!: JoinKeyDepartment | null;

  departmentId!: string | null;
}

// Explicit join key mapping
@Entity({ name: "JoinKeyExplicitEmployee" })
class JoinKeyExplicitEmployee {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("uuid")
  departmentId!: string | null;

  @JoinKey({ departmentId: "id" })
  @ManyToOne(() => JoinKeyDepartment, "explicitEmployees")
  department!: JoinKeyDepartment | null;
}

describe("JoinKey", () => {
  test("should mark the owning side of the relation (auto-calculated keys)", () => {
    const meta = getEntityMetadata(JoinKeyEmployee);
    const rel = meta.relations.find((r) => r.key === "department")!;
    expect(rel.joinKeys).toEqual({ departmentId: "id" });
  });

  test("should use explicit join key mapping when provided", () => {
    const meta = getEntityMetadata(JoinKeyExplicitEmployee);
    const rel = meta.relations.find((r) => r.key === "department")!;
    expect(rel.joinKeys).toEqual({ departmentId: "id" });
  });

  test("should match snapshot for auto join key", () => {
    expect(getEntityMetadata(JoinKeyEmployee)).toMatchSnapshot();
  });

  test("should match snapshot for explicit join key", () => {
    expect(getEntityMetadata(JoinKeyExplicitEmployee)).toMatchSnapshot();
  });
});

import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Cascade } from "./Cascade.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { ManyToOne } from "./ManyToOne.js";
import { OneToMany } from "./OneToMany.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "CascadeParent" })
class CascadeParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => CascadeChild, "parent")
  children!: CascadeChild[];
}

@Entity({ name: "CascadeChild" })
class CascadeChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onInsert: "cascade", onUpdate: "cascade", onDestroy: "cascade" })
  @ManyToOne(() => CascadeParent, "children")
  parent!: CascadeParent | null;

  parentId!: string | null;
}

@Entity({ name: "CascadeSoftParent" })
class CascadeSoftParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => CascadeSoftChild, "parent")
  children!: CascadeSoftChild[];
}

@Entity({ name: "CascadeSoftChild" })
class CascadeSoftChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onSoftDestroy: "cascade" })
  @ManyToOne(() => CascadeSoftParent, "children")
  parent!: CascadeSoftParent | null;

  parentId!: string | null;
}

describe("Cascade", () => {
  test("should stage cascade options on the relation", () => {
    const meta = getEntityMetadata(CascadeChild);
    const rel = meta.relations.find((r) => r.key === "parent")!;
    expect(rel.options.onInsert).toBe("cascade");
    expect(rel.options.onUpdate).toBe("cascade");
    expect(rel.options.onDestroy).toBe("cascade");
  });

  test("should stage onSoftDestroy cascade option", () => {
    const meta = getEntityMetadata(CascadeSoftChild);
    const rel = meta.relations.find((r) => r.key === "parent")!;
    expect(rel.options.onSoftDestroy).toBe("cascade");
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(CascadeChild)).toMatchSnapshot();
  });
});

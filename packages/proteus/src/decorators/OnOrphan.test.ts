import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { ManyToOne } from "./ManyToOne";
import { OnOrphan } from "./OnOrphan";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "OnOrphanParent" })
class OnOrphanParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => OnOrphanDeleteChild, "parent")
  deleteChildren!: OnOrphanDeleteChild[];

  @OneToMany(() => OnOrphanNullifyChild, "parent")
  nullifyChildren!: OnOrphanNullifyChild[];

  @OneToMany(() => OnOrphanIgnoreChild, "parent")
  ignoreChildren!: OnOrphanIgnoreChild[];
}

@Entity({ name: "OnOrphanDeleteChild" })
class OnOrphanDeleteChild {
  @PrimaryKeyField()
  id!: string;

  @OnOrphan("delete")
  @JoinKey()
  @ManyToOne(() => OnOrphanParent, "deleteChildren")
  parent!: OnOrphanParent | null;

  parentId!: string | null;
}

@Entity({ name: "OnOrphanNullifyChild" })
class OnOrphanNullifyChild {
  @PrimaryKeyField()
  id!: string;

  @OnOrphan("nullify")
  @JoinKey()
  @ManyToOne(() => OnOrphanParent, "nullifyChildren")
  parent!: OnOrphanParent | null;

  parentId!: string | null;
}

@Entity({ name: "OnOrphanIgnoreChild" })
class OnOrphanIgnoreChild {
  @PrimaryKeyField()
  id!: string;

  @OnOrphan("ignore")
  @JoinKey()
  @ManyToOne(() => OnOrphanParent, "ignoreChildren")
  parent!: OnOrphanParent | null;

  parentId!: string | null;
}

describe("OnOrphan", () => {
  test("should set onOrphan strategy to delete", () => {
    const meta = getEntityMetadata(OnOrphanDeleteChild);
    const rel = meta.relations.find((r) => r.key === "parent")!;
    expect(rel.options.onOrphan).toBe("delete");
  });

  test("should set onOrphan strategy to nullify", () => {
    const meta = getEntityMetadata(OnOrphanNullifyChild);
    const rel = meta.relations.find((r) => r.key === "parent")!;
    expect(rel.options.onOrphan).toBe("nullify");
  });

  test("should set onOrphan strategy to ignore", () => {
    const meta = getEntityMetadata(OnOrphanIgnoreChild);
    const rel = meta.relations.find((r) => r.key === "parent")!;
    expect(rel.options.onOrphan).toBe("ignore");
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(OnOrphanDeleteChild)).toMatchSnapshot();
  });
});

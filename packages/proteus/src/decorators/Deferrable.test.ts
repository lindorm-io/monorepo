import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Deferrable } from "./Deferrable";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinKey } from "./JoinKey";
import { ManyToOne } from "./ManyToOne";
import { OneToMany } from "./OneToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "DeferrableOwner" })
class DeferrableOwner {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => DeferrableImmediate, "owner")
  immediateChildren!: DeferrableImmediate[];

  @OneToMany(() => DeferrableDeferred, "owner")
  deferredChildren!: DeferrableDeferred[];
}

@Entity({ name: "DeferrableImmediate" })
class DeferrableImmediate {
  @PrimaryKeyField()
  id!: string;

  @Deferrable()
  @JoinKey()
  @ManyToOne(() => DeferrableOwner, "immediateChildren")
  owner!: DeferrableOwner | null;

  ownerId!: string | null;
}

@Entity({ name: "DeferrableDeferred" })
class DeferrableDeferred {
  @PrimaryKeyField()
  id!: string;

  @Deferrable({ initially: true })
  @JoinKey()
  @ManyToOne(() => DeferrableOwner, "deferredChildren")
  owner!: DeferrableOwner | null;

  ownerId!: string | null;
}

describe("Deferrable", () => {
  test("should set deferrable to true with initially false by default", () => {
    const meta = getEntityMetadata(DeferrableImmediate);
    const rel = meta.relations.find((r) => r.key === "owner")!;
    expect(rel.options.deferrable).toBe(true);
    expect(rel.options.initiallyDeferred).toBe(false);
  });

  test("should set initiallyDeferred to true when initially option is true", () => {
    const meta = getEntityMetadata(DeferrableDeferred);
    const rel = meta.relations.find((r) => r.key === "owner")!;
    expect(rel.options.deferrable).toBe(true);
    expect(rel.options.initiallyDeferred).toBe(true);
  });

  test("should match snapshot for DEFERRABLE INITIALLY IMMEDIATE", () => {
    expect(getEntityMetadata(DeferrableImmediate)).toMatchSnapshot();
  });

  test("should match snapshot for DEFERRABLE INITIALLY DEFERRED", () => {
    expect(getEntityMetadata(DeferrableDeferred)).toMatchSnapshot();
  });
});

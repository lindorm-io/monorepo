import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Deferrable } from "./Deferrable.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { JoinKey } from "./JoinKey.js";
import { ManyToOne } from "./ManyToOne.js";
import { OneToMany } from "./OneToMany.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

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

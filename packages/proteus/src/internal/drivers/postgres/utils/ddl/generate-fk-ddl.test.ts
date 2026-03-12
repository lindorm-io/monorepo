import { Cascade } from "../../../../../decorators/Cascade";
import { Deferrable } from "../../../../../decorators/Deferrable";
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
// Test entities — must be at module scope for stage-3 decorator execution.
// Both sides of each relation must be declared so resolve-relations can find
// the inverse side.
// ---------------------------------------------------------------------------

// ── Parent/child for default onDestroy/onUpdate ──────────────────────────────

@Entity({ name: "FkDefaultChild" })
class FkDefaultChild {
  @PrimaryKeyField()
  id!: string;

  @ManyToOne(() => FkDefaultParent, "children")
  parent!: FkDefaultParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkDefaultParent" })
class FkDefaultParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => FkDefaultChild, "parent")
  children!: FkDefaultChild[];
}

// ── Parent/child for cascade ─────────────────────────────────────────────────

@Entity({ name: "FkCascadeChild" })
class FkCascadeChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "cascade", onUpdate: "cascade" })
  @ManyToOne(() => FkCascadeParent, "children")
  parent!: FkCascadeParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkCascadeParent" })
class FkCascadeParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkCascadeChild, "parent")
  children!: FkCascadeChild[];
}

// ── Parent/child for restrict ─────────────────────────────────────────────────

@Entity({ name: "FkRestrictChild" })
class FkRestrictChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "restrict" })
  @ManyToOne(() => FkRestrictParent, "children")
  parent!: FkRestrictParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkRestrictParent" })
class FkRestrictParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkRestrictChild, "parent")
  children!: FkRestrictChild[];
}

// ── OneToOne owning / inverse ─────────────────────────────────────────────────

@Entity({ name: "FkOneToOneProfile" })
class FkOneToOneProfile {
  @PrimaryKeyField()
  id!: string;

  @OneToOne(() => FkOneToOneUser, "profile")
  user!: FkOneToOneUser | null;
}

@Entity({ name: "FkOneToOneUser" })
class FkOneToOneUser {
  @PrimaryKeyField()
  id!: string;

  @JoinKey()
  @OneToOne(() => FkOneToOneProfile, "user")
  profile!: FkOneToOneProfile | null;

  profileId!: string | null;
}

// ── Entity with no owning relations ───────────────────────────────────────────

@Entity({ name: "FkNoRelations" })
class FkNoRelations {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

// ── Parent/child for set_null ─────────────────────────────────────────────────

@Entity({ name: "FkSetNullChild" })
class FkSetNullChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "set_null", onUpdate: "set_null" })
  @ManyToOne(() => FkSetNullParent, "children")
  parent!: FkSetNullParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkSetNullParent" })
class FkSetNullParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkSetNullChild, "parent")
  children!: FkSetNullChild[];
}

// ── Parent/child for set_default ──────────────────────────────────────────────

@Entity({ name: "FkSetDefaultChild" })
class FkSetDefaultChild {
  @PrimaryKeyField()
  id!: string;

  @Cascade({ onDestroy: "set_default", onUpdate: "set_default" })
  @ManyToOne(() => FkSetDefaultParent, "children")
  parent!: FkSetDefaultParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkSetDefaultParent" })
class FkSetDefaultParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkSetDefaultChild, "parent")
  children!: FkSetDefaultChild[];
}

// ── Parent/child for deferrable (INITIALLY IMMEDIATE) ─────────────────────────

@Entity({ name: "FkDeferrableImmediateChild" })
class FkDeferrableImmediateChild {
  @PrimaryKeyField()
  id!: string;

  @Deferrable()
  @ManyToOne(() => FkDeferrableImmediateParent, "children")
  parent!: FkDeferrableImmediateParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkDeferrableImmediateParent" })
class FkDeferrableImmediateParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkDeferrableImmediateChild, "parent")
  children!: FkDeferrableImmediateChild[];
}

// ── Parent/child for deferrable (INITIALLY DEFERRED) ──────────────────────────

@Entity({ name: "FkDeferrableDeferredChild" })
class FkDeferrableDeferredChild {
  @PrimaryKeyField()
  id!: string;

  @Deferrable({ initially: true })
  @ManyToOne(() => FkDeferrableDeferredParent, "children")
  parent!: FkDeferrableDeferredParent | null;

  parentId!: string | null;
}

@Entity({ name: "FkDeferrableDeferredParent" })
class FkDeferrableDeferredParent {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkDeferrableDeferredChild, "parent")
  children!: FkDeferrableDeferredChild[];
}

// ── Inverse-only entity ───────────────────────────────────────────────────────

@Entity({ name: "FkInverseOnly" })
class FkInverseOnly {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => FkDefaultChild, "parent")
  items!: FkDefaultChild[];
}

const NS = null;
const NS_SCOPED = "crm";
const OPTS = {};

describe("generateFkDDL", () => {
  test("returns empty array for entity with no relations", () => {
    const meta = getEntityMetadata(FkNoRelations);
    expect(generateFkDDL(meta, "FkNoRelations", NS, OPTS)).toEqual([]);
  });

  test("generates FK constraint with default ON DELETE NO ACTION ON UPDATE NO ACTION", () => {
    const meta = getEntityMetadata(FkDefaultChild);
    expect(generateFkDDL(meta, "FkDefaultChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generates FK constraint with ON DELETE CASCADE ON UPDATE CASCADE", () => {
    const meta = getEntityMetadata(FkCascadeChild);
    expect(generateFkDDL(meta, "FkCascadeChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generates FK constraint with ON DELETE RESTRICT", () => {
    const meta = getEntityMetadata(FkRestrictChild);
    expect(generateFkDDL(meta, "FkRestrictChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generates FK constraint with ON DELETE SET NULL ON UPDATE SET NULL", () => {
    const meta = getEntityMetadata(FkSetNullChild);
    expect(generateFkDDL(meta, "FkSetNullChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generated DDL contains ON DELETE SET NULL for set_null onDestroy", () => {
    const meta = getEntityMetadata(FkSetNullChild);
    const result = generateFkDDL(meta, "FkSetNullChild", NS, OPTS);
    expect(result[0]).toContain("ON DELETE SET NULL");
  });

  test("generated DDL contains ON UPDATE SET NULL for set_null onUpdate", () => {
    const meta = getEntityMetadata(FkSetNullChild);
    const result = generateFkDDL(meta, "FkSetNullChild", NS, OPTS);
    expect(result[0]).toContain("ON UPDATE SET NULL");
  });

  test("generates FK constraint for OneToOne owning side", () => {
    const meta = getEntityMetadata(FkOneToOneUser);
    expect(generateFkDDL(meta, "FkOneToOneUser", NS, OPTS)).toMatchSnapshot();
  });

  test("returns empty array for inverse-side entity (OneToMany — no joinKeys)", () => {
    const meta = getEntityMetadata(FkDefaultParent);
    expect(generateFkDDL(meta, "FkDefaultParent", NS, OPTS)).toEqual([]);
  });

  test("returns empty array for inverse OneToOne entity", () => {
    const meta = getEntityMetadata(FkOneToOneProfile);
    expect(generateFkDDL(meta, "FkOneToOneProfile", NS, OPTS)).toEqual([]);
  });

  test("uses schema-qualified table name when namespace is provided", () => {
    const meta = getEntityMetadata(FkDefaultChild);
    const result = generateFkDDL(meta, "FkDefaultChild", NS_SCOPED, OPTS);
    // ALTER TABLE target is schema-qualified
    expect(result[0]).toContain('"crm"."FkDefaultChild"');
    // REFERENCES target is also schema-qualified
    expect(result[0]).toContain('REFERENCES "crm"."FkDefaultParent"');
    expect(result).toMatchSnapshot();
  });

  test("constraint name starts with fk_ and contains 16-char hex hash", () => {
    const meta = getEntityMetadata(FkDefaultChild);
    const result = generateFkDDL(meta, "FkDefaultChild", NS, OPTS);
    expect(result[0]).toMatch(/ADD CONSTRAINT "fk_[A-Za-z0-9_-]{11}"/);
  });

  test("ALTER TABLE statement ends with a semicolon", () => {
    const meta = getEntityMetadata(FkDefaultChild);
    const result = generateFkDDL(meta, "FkDefaultChild", NS, OPTS);
    expect(result[0].endsWith(";")).toBe(true);
  });

  test("generates FK constraint with ON DELETE SET DEFAULT ON UPDATE SET DEFAULT", () => {
    const meta = getEntityMetadata(FkSetDefaultChild);
    expect(generateFkDDL(meta, "FkSetDefaultChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generated DDL contains ON DELETE SET DEFAULT for set_default onDestroy", () => {
    const meta = getEntityMetadata(FkSetDefaultChild);
    const result = generateFkDDL(meta, "FkSetDefaultChild", NS, OPTS);
    expect(result[0]).toContain("ON DELETE SET DEFAULT");
  });

  test("generated DDL contains ON UPDATE SET DEFAULT for set_default onUpdate", () => {
    const meta = getEntityMetadata(FkSetDefaultChild);
    const result = generateFkDDL(meta, "FkSetDefaultChild", NS, OPTS);
    expect(result[0]).toContain("ON UPDATE SET DEFAULT");
  });

  test("generates FK constraint with DEFERRABLE INITIALLY IMMEDIATE when deferrable is set without initially", () => {
    const meta = getEntityMetadata(FkDeferrableImmediateChild);
    expect(generateFkDDL(meta, "FkDeferrableImmediateChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generated DDL contains DEFERRABLE INITIALLY IMMEDIATE when deferrable: true, initiallyDeferred: false", () => {
    const meta = getEntityMetadata(FkDeferrableImmediateChild);
    const result = generateFkDDL(meta, "FkDeferrableImmediateChild", NS, OPTS);
    expect(result[0]).toContain("DEFERRABLE INITIALLY IMMEDIATE");
  });

  test("generates FK constraint with DEFERRABLE INITIALLY DEFERRED when deferrable and initially are set", () => {
    const meta = getEntityMetadata(FkDeferrableDeferredChild);
    expect(generateFkDDL(meta, "FkDeferrableDeferredChild", NS, OPTS)).toMatchSnapshot();
  });

  test("generated DDL contains DEFERRABLE INITIALLY DEFERRED when deferrable: true, initiallyDeferred: true", () => {
    const meta = getEntityMetadata(FkDeferrableDeferredChild);
    const result = generateFkDDL(meta, "FkDeferrableDeferredChild", NS, OPTS);
    expect(result[0]).toContain("DEFERRABLE INITIALLY DEFERRED");
  });

  test("non-deferrable constraint has no DEFERRABLE clause", () => {
    const meta = getEntityMetadata(FkDefaultChild);
    const result = generateFkDDL(meta, "FkDefaultChild", NS, OPTS);
    expect(result[0]).not.toContain("DEFERRABLE");
  });
});

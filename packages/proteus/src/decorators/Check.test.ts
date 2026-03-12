import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Check } from "./Check";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "CheckUnnamed" })
@Check("age >= 0")
class CheckUnnamed {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  age!: number;
}

@Entity({ name: "CheckNamed" })
@Check("score BETWEEN 0 AND 100", { name: "chk_score_range" })
class CheckNamed {
  @PrimaryKeyField()
  id!: string;

  @Field("float")
  score!: number;
}

@Entity({ name: "CheckMultiple" })
@Check("age >= 0", { name: "chk_age_positive" })
@Check("score <= 100")
class CheckMultiple {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  age!: number;

  @Field("float")
  score!: number;
}

describe("Check", () => {
  test("should register unnamed check constraint", () => {
    const meta = getEntityMetadata(CheckUnnamed);
    expect(meta.checks.length).toBe(1);
    expect(meta.checks[0].expression).toBe("age >= 0");
    expect(meta.checks[0].name).toBeNull();
  });

  test("should register named check constraint", () => {
    const meta = getEntityMetadata(CheckNamed);
    expect(meta.checks[0].name).toBe("chk_score_range");
  });

  test("should register multiple check constraints", () => {
    expect(getEntityMetadata(CheckMultiple)).toMatchSnapshot();
  });
});

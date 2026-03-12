import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Filter } from "./Filter";
import { Nullable } from "./Nullable";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "FilterActive" })
@Filter({ name: "active", cond: { status: "active" }, default: true })
class FilterActive {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  status!: string;
}

@Entity({ name: "FilterTenant" })
@Filter({ name: "tenant", cond: { tenantId: "$tenantId" } })
class FilterTenant {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

@Entity({ name: "FilterMultiple" })
@Filter({ name: "active", cond: { deletedAt: null }, default: true })
@Filter({ name: "tenant", cond: { tenantId: "$tenantId" } })
class FilterMultiple {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;

  @Field("timestamp")
  @Nullable()
  deletedAt!: Date | null;
}

@Entity({ name: "FilterNested" })
@Filter({
  name: "recent",
  cond: { createdAt: { $gte: "$since" } },
  default: false,
})
class FilterNested {
  @PrimaryKeyField()
  id!: string;

  @Field("timestamp")
  createdAt!: Date;
}

@Entity({ name: "FilterAndOr" })
@Filter({
  name: "visible",
  cond: { $or: [{ status: "published" }, { status: "featured" }] },
  default: true,
})
class FilterAndOr {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  status!: string;
}

describe("Filter", () => {
  test("should register a default-on filter", () => {
    const meta = getEntityMetadata(FilterActive);
    expect(meta.filters).toHaveLength(1);
    expect(meta.filters[0]).toMatchSnapshot();
  });

  test("should register a parameterized filter with default off", () => {
    const meta = getEntityMetadata(FilterTenant);
    expect(meta.filters).toHaveLength(1);
    expect(meta.filters[0]).toMatchSnapshot();
  });

  test("should register multiple filters", () => {
    const meta = getEntityMetadata(FilterMultiple);
    expect(meta.filters).toHaveLength(2);
    expect(meta.filters).toMatchSnapshot();
  });

  test("should register filter with nested operator condition", () => {
    const meta = getEntityMetadata(FilterNested);
    expect(meta.filters[0]).toMatchSnapshot();
  });

  test("should register filter with $or condition", () => {
    const meta = getEntityMetadata(FilterAndOr);
    expect(meta.filters[0]).toMatchSnapshot();
  });
});

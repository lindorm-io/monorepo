import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Namespace } from "./Namespace";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Namespace("tenant")
@Entity({ name: "NamespacedEntity" })
class NamespacedEntity {
  @PrimaryKeyField()
  id!: string;
}

@Namespace("public")
@Entity({ name: "NamespacedPublicEntity" })
class NamespacedPublicEntity {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "NoNamespaceEntity" })
class NoNamespaceEntity {
  @PrimaryKeyField()
  id!: string;
}

describe("Namespace", () => {
  test("should stage namespace on entity metadata", () => {
    const meta = getEntityMetadata(NamespacedEntity);
    expect(meta.entity.namespace).toBe("tenant");
  });

  test("should stage different namespace values", () => {
    const meta = getEntityMetadata(NamespacedPublicEntity);
    expect(meta.entity.namespace).toBe("public");
  });

  test("should default namespace to null when not decorated", () => {
    const meta = getEntityMetadata(NoNamespaceEntity);
    expect(meta.entity.namespace).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(NamespacedEntity)).toMatchSnapshot();
  });
});

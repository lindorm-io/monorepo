import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Encrypted } from "./Encrypted";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "EncryptedNoOptions" })
class EncryptedNoOptions {
  @PrimaryKeyField()
  id!: string;

  @Encrypted()
  @Field("string")
  secret!: string;
}

@Entity({ name: "EncryptedWithPurpose" })
class EncryptedWithPurpose {
  @PrimaryKeyField()
  id!: string;

  @Encrypted({ purpose: "pii" })
  @Field("string")
  ssn!: string;
}

@Entity({ name: "EncryptedMultiplePredicateKeys" })
class EncryptedMultiplePredicateKeys {
  @PrimaryKeyField()
  id!: string;

  @Encrypted({ id: "key-id", purpose: "pii" })
  @Field("string")
  data!: string;
}

@Entity({ name: "EncryptedUndefinedValues" })
class EncryptedUndefinedValues {
  @PrimaryKeyField()
  id!: string;

  @Encrypted({ purpose: undefined })
  @Field("string")
  info!: string;
}

@Entity({ name: "EncryptedNotDecorated" })
class EncryptedNotDecorated {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("Encrypted", () => {
  test("should stage encrypted with null predicate when no options provided", () => {
    const meta = getEntityMetadata(EncryptedNoOptions);
    const field = meta.fields.find((f) => f.key === "secret")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage encrypted with purpose predicate", () => {
    const meta = getEntityMetadata(EncryptedWithPurpose);
    const field = meta.fields.find((f) => f.key === "ssn")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage encrypted with multiple predicate keys", () => {
    const meta = getEntityMetadata(EncryptedMultiplePredicateKeys);
    const field = meta.fields.find((f) => f.key === "data")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage encrypted with null predicate when all option values are undefined", () => {
    const meta = getEntityMetadata(EncryptedUndefinedValues);
    const field = meta.fields.find((f) => f.key === "info")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should default encrypted to null when not decorated", () => {
    const meta = getEntityMetadata(EncryptedNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.encrypted).toBeNull();
  });

  test("should match full metadata snapshot for entity with encrypted field", () => {
    const meta = getEntityMetadata(EncryptedWithPurpose);
    expect(meta).toMatchSnapshot();
  });
});

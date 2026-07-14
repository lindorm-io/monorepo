import { KryptosKit } from "@lindorm/kryptos";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Encrypted } from "./Encrypted.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

// A KEK is typically an env key, imported at module scope — so it is available at
// class-definition time and can be handed straight to the decorator.
const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: "https://test.proteus/",
});

@Entity({ name: "EncryptedNoOptions" })
class EncryptedNoOptions {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted()
  @Field("string")
  secret!: string;
}

@Entity({ name: "EncryptedWithPredicate" })
class EncryptedWithPredicate {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ predicate: { purpose: "pii" } })
  @Field("string")
  ssn!: string;
}

@Entity({ name: "EncryptedMultiplePredicateKeys" })
class EncryptedMultiplePredicateKeys {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ predicate: { id: "key-id", purpose: "pii" } })
  @Field("string")
  data!: string;
}

@Entity({ name: "EncryptedWithKryptos" })
class EncryptedWithKryptos {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ kryptos: KEK })
  @Field("string")
  token!: string;
}

@Entity({ name: "EncryptedNotDecorated" })
class EncryptedNotDecorated {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

describe("Encrypted", () => {
  test("should stage a bare descriptor when no options are provided", () => {
    const meta = getEntityMetadata(EncryptedNoOptions);
    const field = meta.fields.find((f) => f.key === "secret")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage the predicate", () => {
    const meta = getEntityMetadata(EncryptedWithPredicate);
    const field = meta.fields.find((f) => f.key === "ssn")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage a predicate with multiple keys", () => {
    const meta = getEntityMetadata(EncryptedMultiplePredicateKeys);
    const field = meta.fields.find((f) => f.key === "data")!;
    expect(field.encrypted).toMatchSnapshot();
  });

  test("should stage an injected kryptos", () => {
    const meta = getEntityMetadata(EncryptedWithKryptos);
    const field = meta.fields.find((f) => f.key === "token")!;
    expect(field.encrypted).toEqual({ kryptos: KEK, predicate: null });
  });

  test("should default encrypted to null when not decorated", () => {
    const meta = getEntityMetadata(EncryptedNotDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.encrypted).toBeNull();
  });

  test("should match full metadata snapshot for entity with encrypted field", () => {
    const meta = getEntityMetadata(EncryptedWithPredicate);
    expect(meta).toMatchSnapshot();
  });
});

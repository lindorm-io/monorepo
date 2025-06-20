import { Dict } from "@lindorm/types";
import { Column, Entity, PrimaryKeyColumn } from "../decorators";
import { defaultCreateEntity } from "./default-create-entity";
import { defaultValidateEntity } from "./default-validate-entity";

describe("defaultValidateEntity", () => {
  test("should validate", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    class TestValidationEntity {
      @PrimaryKeyColumn()
      id!: string;

      @Column("array", { fallback: [] })
      array!: any[];

      @Column("bigint", { fallback: BigInt(0) })
      bigint!: bigint;

      @Column("boolean", { fallback: false })
      boolean!: boolean;

      @Column("date", { fallback: new Date() })
      date!: Date;

      @Column("email", { fallback: "test@email.com" })
      email!: string;

      @Column("enum", { enum: TestEnum, fallback: TestEnum.One })
      enum!: TestEnum;

      @Column("integer", { fallback: 0 })
      number!: number;

      @Column("object", { fallback: {} })
      object!: Dict;

      @Column("string", { fallback: "string" })
      string!: string;

      @Column("url", { fallback: "https://example.com" })
      url!: string;

      @Column("uuid", { fallback: "00000000-0000-0000-0000-000000000000" })
      uuid!: string;
    }

    expect(() =>
      defaultValidateEntity(
        TestValidationEntity,
        defaultCreateEntity(TestValidationEntity),
      ),
    ).not.toThrow();
  });
});

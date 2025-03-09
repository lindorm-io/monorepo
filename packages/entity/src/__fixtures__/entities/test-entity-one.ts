import { EntityBase } from "../../classes";
import { Column, Entity, OnValidate } from "../../decorators";

@Entity()
@OnValidate((entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
})
export class TestEntityOne extends EntityBase {
  @Column("string", { nullable: true })
  public readonly email!: string | null;

  @Column("string")
  public readonly name!: string;
}

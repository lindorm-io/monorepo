import { Column, Entity, EntityBase, OnValidate } from "@lindorm/entity";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

@Entity()
@OnValidate((entity: TestEntityOne) => {
  console.log(entity.email);
})
export class TestEntityOne extends EntityBase {
  @Column("string", { nullable: true })
  public email!: string | null;

  @Column("string")
  public name!: string;
}

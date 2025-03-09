import { EntityBase } from "../../classes";
import { Column, Entity } from "../../decorators";

@Entity()
export class TestEntityTwo extends EntityBase {
  @Column("string")
  public readonly email!: string;

  @Column("string")
  public readonly name!: string;

  @Column()
  public readonly _test!: any;
}

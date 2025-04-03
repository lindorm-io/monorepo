import { Entity, OneToMany, PrimaryKeyColumn } from "../../decorators";
import { ManyToOneSecondDecoratorEntity } from "./ManyToOneSecond";

@Entity()
export class OneToManyFirstDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @OneToMany(() => ManyToOneSecondDecoratorEntity, "first")
  second!: Array<ManyToOneSecondDecoratorEntity>;
}

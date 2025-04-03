import { Entity, ManyToMany, PrimaryKeyColumn } from "../../decorators";
import { ManyToManySecondDecoratorEntity } from "./ManyToManySecond";

@Entity()
export class ManyToManyFirstDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @ManyToMany(() => ManyToManySecondDecoratorEntity, "first", true)
  second!: Array<ManyToManySecondDecoratorEntity>;
}

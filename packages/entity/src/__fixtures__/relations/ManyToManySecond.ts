import { Entity, ManyToMany, PrimaryKeyColumn } from "../../decorators";
import { ManyToManyFirstDecoratorEntity } from "./ManyToManyFirst";

@Entity()
export class ManyToManySecondDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @ManyToMany(() => ManyToManyFirstDecoratorEntity, "second")
  first!: Array<ManyToManyFirstDecoratorEntity>;
}

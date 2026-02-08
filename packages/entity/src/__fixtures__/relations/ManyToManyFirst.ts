import { Entity, ManyToMany, PrimaryKeyColumn } from "../../decorators";
import { ManyToManySecondDecoratorEntity } from "./ManyToManySecond";

@Entity()
export class ManyToManyFirstDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @ManyToMany(() => ManyToManySecondDecoratorEntity, "first", {
    hasJoinTable: true,
    joinKeys: ["id"],
  })
  second!: Array<ManyToManySecondDecoratorEntity>;
}

import { Entity, OneToOne, PrimaryKeyColumn } from "../../decorators";
import { OneToOneSecondDecoratorEntity } from "./OneToOneSecond";

@Entity()
export class OneToOneFirstDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @OneToOne(() => OneToOneSecondDecoratorEntity, "first", { hasJoinKey: true })
  second!: OneToOneSecondDecoratorEntity;
}

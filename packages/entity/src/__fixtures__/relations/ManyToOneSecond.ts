import { Entity, ManyToOne, PrimaryKeyColumn } from "../../decorators";
import { OneToManyFirstDecoratorEntity } from "./OneToManyFirst";

@Entity()
export class ManyToOneSecondDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @ManyToOne(() => OneToManyFirstDecoratorEntity, "second")
  first!: OneToManyFirstDecoratorEntity;
}

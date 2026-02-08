import { Entity, OneToOne, PrimaryKeyColumn } from "../../decorators";
import { OneToOneFirstDecoratorEntity } from "./OneToOneFirst";

@Entity()
export class OneToOneSecondDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @OneToOne(() => OneToOneFirstDecoratorEntity, "second")
  first!: OneToOneFirstDecoratorEntity;
}

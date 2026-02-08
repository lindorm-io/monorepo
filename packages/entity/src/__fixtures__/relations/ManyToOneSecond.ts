import { Column, Entity, ManyToOne, PrimaryKeyColumn } from "../../decorators";
import { OneToManyFirstDecoratorEntity } from "./OneToManyFirst";

@Entity()
export class ManyToOneSecondDecoratorEntity {
  @PrimaryKeyColumn()
  id!: string;

  @Column()
  testId!: string;

  @ManyToOne(() => OneToManyFirstDecoratorEntity, "second", {
    joinKeys: { testId: "id" },
  })
  first!: OneToManyFirstDecoratorEntity;
}

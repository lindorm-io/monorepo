import { EntityBase } from "../../classes";
import { Column, Entity, ExpiryDateColumn, UpdateDateColumn } from "../../decorators";

@Entity()
export default class TestEntityThree extends EntityBase {
  @ExpiryDateColumn()
  public expiresAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @Column()
  public email!: string | null;

  @Column()
  public name!: string;
}

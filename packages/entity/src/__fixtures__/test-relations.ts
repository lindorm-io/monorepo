import { randomUUID } from "crypto";
import { EntityBase } from "../classes";
import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
} from "../decorators";

@Entity()
export class TestRelationOne extends EntityBase {
  @Column("string")
  public name!: string;

  @OneToMany(() => TestRelationTwo, "one")
  public twos!: Array<any>; // Array<TestRelationTwo>;

  @OneToOne(() => TestRelationFour, "one")
  public four!: any; // TestRelationFour;

  @ManyToMany(() => TestRelationFive, "ones", { hasJoinTable: true })
  public fives!: Array<any>; // Array<TestRelationFive>

  @ManyToMany(() => TestRelationOne, "many", { hasJoinTable: true })
  public many!: Array<any>; // Array<TestRelationFive>
}

@Entity()
@PrimaryKey(["first", "second"])
export class TestRelationTwo {
  @Column("string")
  public first!: string;

  @Column("string")
  public second!: string;

  @Column("string")
  public name!: string;

  @Column("string")
  public customOneId!: string;

  @ManyToOne(() => TestRelationOne, "twos", { joinKeys: { customOneId: "id" } })
  public one!: any; // TestRelationOne;

  @OneToMany(() => TestRelationThree, "two")
  public threes!: Array<any>; // Array<TestRelationThree>;
}

@Entity()
export class TestRelationThree extends EntityBase {
  @Column("string")
  public name!: string;

  @ManyToOne(() => TestRelationTwo, "threes")
  public two!: any; // TestRelationOne;
}

@Entity()
export class TestRelationFour extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("string")
  public customFourId!: string;

  @OneToOne(() => TestRelationOne, "four", { joinKeys: { customFourId: "id" } })
  public one!: any; // TestRelationOne;
}

@Entity()
export class TestRelationFive extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("uuid", { fallback: () => randomUUID() })
  public manyId!: string;

  @ManyToMany(() => TestRelationOne, "fives", { joinKeys: ["manyId"] })
  public ones!: Array<any>; // Array<TestRelationOne>;
}

import {
  Column,
  Entity,
  EntityBase,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  PrimarySource,
} from "@lindorm/entity";
import { randomUUID } from "crypto";

@Entity()
@PrimarySource("MongoSource")
export class TestRelationOne extends EntityBase {
  @Column("string")
  public name!: string;

  @OneToMany(() => TestRelationTwo, "one", {
    loading: "eager",
    onInsert: "cascade",
    onUpdate: "cascade",
    onOrphan: "delete",
    onDestroy: "cascade",
  })
  public twos!: Array<any>;

  @OneToOne(() => TestRelationFour, "one", {
    loading: "eager",
    onInsert: "cascade",
    onUpdate: "cascade",
    onOrphan: "delete",
    onDestroy: "cascade",
    nullable: true,
  })
  public four!: any;

  @ManyToMany(() => TestRelationFive, "ones", {
    hasJoinTable: true,
    loading: "eager",
    onInsert: "cascade",
    onUpdate: "cascade",
    onOrphan: "delete",
    onDestroy: "cascade",
  })
  public fives!: Array<any>;

  @ManyToMany(() => TestRelationOne, "many", {
    hasJoinTable: true,
    loading: "eager",
    onInsert: "cascade",
    onUpdate: "cascade",
    onOrphan: "delete",
    onDestroy: "cascade",
  })
  public many!: Array<any>;
}

@Entity()
@PrimarySource("MongoSource")
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

  @ManyToOne(() => TestRelationOne, "twos", {
    joinKeys: { customOneId: "id" },
    loading: "eager",
  })
  public one!: any;

  @OneToMany(() => TestRelationThree, "two", { loading: "eager", onInsert: "cascade" })
  public threes!: Array<any>;
}

@Entity()
@PrimarySource("MongoSource")
export class TestRelationThree extends EntityBase {
  @Column("string")
  public name!: string;

  @ManyToOne(() => TestRelationTwo, "threes", { loading: "eager" })
  public two!: any;
}

@Entity()
@PrimarySource("MongoSource")
export class TestRelationFour extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("string")
  public customFourId!: string;

  @OneToOne(() => TestRelationOne, "four", {
    joinKeys: { customFourId: "id" },
    loading: "eager",
  })
  public one!: any;
}

@Entity()
@PrimarySource("MongoSource")
export class TestLazyOne extends EntityBase {
  @Column("string")
  public name!: string;

  @OneToMany(() => TestLazyTwo, "one", {
    loading: "lazy",
    onInsert: "cascade",
    onDestroy: "cascade",
  })
  public twos!: Array<any>;
}

@Entity()
@PrimarySource("MongoSource")
export class TestLazyTwo extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("string")
  public lazyOneId!: string;

  @ManyToOne(() => TestLazyOne, "twos", {
    joinKeys: { lazyOneId: "id" },
    loading: "lazy",
  })
  public one!: any;
}

@Entity()
@PrimarySource("MongoSource")
export class TestRelationFive extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("uuid", { fallback: () => randomUUID() })
  public manyId!: string;

  @ManyToMany(() => TestRelationOne, "fives", { joinKeys: ["manyId"], loading: "eager" })
  public ones!: Array<any>;
}

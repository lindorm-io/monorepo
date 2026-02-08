import { EntityBase } from "../classes";
import { Column, Entity, ManyToOne, OneToMany } from "../decorators";

/**
 * Test entities for circular relation detection.
 * These form a circular dependency: CircularA -> CircularB -> CircularC -> CircularA
 */

@Entity()
export class CircularA extends EntityBase {
  @Column("string")
  public name!: string;

  @OneToMany(() => CircularB, "a")
  public bs!: Array<CircularB>;

  @OneToMany(() => CircularC, "a")
  public cs!: Array<CircularC>;
}

@Entity()
export class CircularB extends EntityBase {
  @Column("string")
  public name!: string;

  @ManyToOne(() => CircularA, "bs")
  public a!: CircularA;

  @OneToMany(() => CircularC, "b")
  public cs!: Array<CircularC>;
}

@Entity()
export class CircularC extends EntityBase {
  @Column("string")
  public name!: string;

  @ManyToOne(() => CircularB, "cs")
  public b!: CircularB;

  @ManyToOne(() => CircularA, "cs")
  public a!: CircularA;
}

// Add the reverse relation to CircularA
// This creates the cycle: A -> B -> C -> A

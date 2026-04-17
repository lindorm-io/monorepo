import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { ManyToOne } from "./ManyToOne";
import { OneToMany } from "./OneToMany";
import { OrderBy } from "./OrderBy";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "OrderByTeam" })
class OrderByTeam {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OrderBy({ name: "ASC" })
  @OneToMany(() => OrderByPlayer, "team")
  players!: OrderByPlayer[];

  @OneToMany(() => OrderByCoach, "team")
  coaches!: OrderByCoach[];
}

@Entity({ name: "OrderByPlayer" })
class OrderByPlayer {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToOne(() => OrderByTeam, "players")
  team!: OrderByTeam | null;

  teamId!: string | null;
}

@Entity({ name: "OrderByCoach" })
class OrderByCoach {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToOne(() => OrderByTeam, "coaches")
  team!: OrderByTeam | null;

  teamId!: string | null;
}

describe("OrderBy", () => {
  test("should stage orderBy spec on the relation", () => {
    const meta = getEntityMetadata(OrderByTeam);
    const rel = meta.relations.find((r) => r.key === "players")!;
    expect(rel.orderBy).toEqual({ name: "ASC" });
  });

  test("should default orderBy to null when not decorated", () => {
    const meta = getEntityMetadata(OrderByTeam);
    const rel = meta.relations.find((r) => r.key === "coaches")!;
    expect(rel.orderBy).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(OrderByTeam)).toMatchSnapshot();
  });
});

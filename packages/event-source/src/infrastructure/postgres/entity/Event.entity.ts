import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";
import { EventStoreAttributes } from "../../../types";

@Entity({ name: "event_store" })
@Index(["id", "name", "context"], {
  unique: false,
})
@Index(["id", "name", "context", "causation_id"], {
  unique: true,
})
@Index(["id", "name", "context", "previous_event_id"], {
  unique: true,
})
@Index(["id", "name", "context", "expected_events"], {
  unique: true,
})
export class EventEntity implements EventStoreAttributes {
  @PrimaryColumn("uuid")
  public readonly id: string;

  @PrimaryColumn()
  public readonly name: string;

  @PrimaryColumn()
  public readonly context: string;

  @PrimaryColumn("uuid")
  public readonly causation_id: string;

  @Column("uuid")
  public readonly correlation_id: string;

  @Column("jsonb")
  public readonly events: any;

  @Column("integer")
  public readonly expected_events: number;

  @Column()
  public readonly origin: string;

  @Column({ nullable: true })
  public readonly originator: string | null;

  @Column("uuid", { nullable: true })
  public readonly previous_event_id: string | null;

  // automatic

  @CreateDateColumn()
  public readonly timestamp: Date;
}

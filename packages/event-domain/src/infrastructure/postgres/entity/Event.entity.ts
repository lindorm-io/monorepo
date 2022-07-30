import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_store" })
@Index(["aggregate_id", "aggregate_name", "aggregate_context"])
@Index(["aggregate_id", "aggregate_name", "aggregate_context", "previous_event_id"], {
  unique: true,
})
@Index(["aggregate_id", "aggregate_name", "aggregate_context", "expected_events"], { unique: true })
export class EventEntity {
  @PrimaryColumn("uuid", { unique: true })
  public readonly id: string;

  @Column()
  public readonly name: string;

  @Column("uuid")
  public readonly aggregate_id: string;

  @Column()
  public readonly aggregate_name: string;

  @Column()
  public readonly aggregate_context: string;

  @Column("uuid")
  public readonly causation_id: string;

  @Column("uuid")
  public readonly correlation_id: string;

  @Column("jsonb")
  public readonly data: Record<string, any>;

  @Column("integer")
  public readonly expected_events: number;

  @Column("uuid", { nullable: true })
  public readonly previous_event_id: string | null;

  // automatic

  @CreateDateColumn()
  public readonly timestamp: Date;
}

import { CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "saga_causation" })
@Index(["saga_id", "saga_name", "saga_context"])
@Index(["saga_id", "saga_name", "saga_context", "causation_id"], {
  unique: true,
})
export class SagaCausationEntity {
  @PrimaryColumn()
  public saga_id: string;

  @PrimaryColumn()
  public saga_name: string;

  @PrimaryColumn()
  public saga_context: string;

  @PrimaryColumn("uuid")
  public causation_id: string;

  // automatic

  @CreateDateColumn()
  public timestamp: Date;
}

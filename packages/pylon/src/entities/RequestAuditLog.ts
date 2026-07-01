import {
  CreateDateField,
  Entity,
  Field,
  Generated,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";
import type { PylonClientContext } from "../types/index.js";

@Namespace("pylon")
@Entity()
export class RequestAuditLog {
  @PrimaryKeyField()
  @Generated("lindorm_id", { namespace: "aud" })
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Index()
  @Field("string")
  requestId!: string;

  @Index()
  @Field("string")
  correlationId!: string;

  @Index()
  @Field("string")
  actor!: string;

  @Field("string")
  appName!: string;

  @Index()
  @Field("string")
  endpoint!: string;

  @Field("string")
  method!: string;

  @Field("string")
  transport!: string;

  @Field("integer")
  statusCode!: number;

  @Field("integer")
  duration!: number;

  @Field("string")
  sourceIp!: string;

  @Nullable()
  @Field("json")
  requestBody!: Record<string, unknown> | null;

  @Nullable()
  @Field("string")
  sessionId!: string | null;

  @Nullable()
  @Field("json")
  client!: PylonClientContext | null;
}

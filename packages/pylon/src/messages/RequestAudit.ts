import {
  CorrelationField,
  DeadLetter,
  Field,
  Generated,
  IdentifierField,
  Message,
  Namespace,
  Nullable,
  Retry,
  TimestampField,
  Topic,
} from "@lindorm/iris";
import type { PylonClientContext } from "../types/index.js";

@Namespace("pylon")
@Message()
@Topic("audit.request")
@Retry({ maxRetries: 5, strategy: "exponential", delay: 1000 })
@DeadLetter()
export class RequestAudit {
  // ⚠ `@IdentifierField` stages a non-nullable, non-optional string and
  // generates NOTHING, so without this every publish failed validation — and
  // the middleware's `.catch(log)` swallowed it, which is why an audit block
  // could look wired up while never emitting a single record.
  @IdentifierField()
  @Generated("lindorm_id", { namespace: "aud" })
  readonly id!: string;

  @CorrelationField()
  readonly correlationId!: string;

  @TimestampField()
  readonly timestamp!: Date;

  @Field("string")
  readonly requestId!: string;

  @Field("string")
  readonly actor!: string;

  @Field("string")
  readonly appName!: string;

  @Field("string")
  readonly endpoint!: string;

  @Field("string")
  readonly method!: string;

  @Field("string")
  readonly transport!: string;

  @Field("integer")
  readonly statusCode!: number;

  @Field("integer")
  readonly duration!: number;

  @Field("string")
  readonly sourceIp!: string;

  @Nullable()
  @Field("object")
  readonly requestBody!: Record<string, unknown> | null;

  @Nullable()
  @Field("string")
  readonly sessionId!: string | null;

  @Nullable()
  @Field("object")
  readonly client!: PylonClientContext | null;

  /**
   * Set only when the request threw. The error's identifying `code` and `type`
   * — never its message or stack, which are interpolated at the throw site and
   * can carry request values the `sanitise` hook never sees.
   */
  @Nullable()
  @Field("string")
  readonly errorCode!: string | null;

  @Nullable()
  @Field("string")
  readonly errorType!: string | null;
}

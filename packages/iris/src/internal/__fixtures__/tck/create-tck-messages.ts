// TCK Message Factory
//
// Each call produces fresh class declarations with fresh Symbol.metadata.

import { z } from "zod";
import type { IMessage } from "../../../interfaces/index.js";
import { Compressed } from "../../../decorators/Compressed.js";
import { CorrelationField } from "../../../decorators/CorrelationField.js";
import { Default } from "../../../decorators/Default.js";
import { Encrypted } from "../../../decorators/Encrypted.js";
import { Field } from "../../../decorators/Field.js";
import { Header } from "../../../decorators/Header.js";
import { IdentifierField } from "../../../decorators/IdentifierField.js";
import { MandatoryField } from "../../../decorators/MandatoryField.js";
import { Message } from "../../../decorators/Message.js";
import { OnCreate } from "../../../decorators/OnCreate.js";
import { OnHydrate } from "../../../decorators/OnHydrate.js";
import { OnValidate } from "../../../decorators/OnValidate.js";
import { PersistentField } from "../../../decorators/PersistentField.js";
import { Retry } from "../../../decorators/Retry.js";
import { Schema } from "../../../decorators/Schema.js";
import { DeadLetter } from "../../../decorators/DeadLetter.js";
import { Expiry } from "../../../decorators/Expiry.js";
import { Broadcast } from "../../../decorators/Broadcast.js";
import { TimestampField } from "../../../decorators/TimestampField.js";
import { Namespace } from "../../../decorators/Namespace.js";
import { Topic } from "../../../decorators/Topic.js";
import { Transform } from "../../../decorators/Transform.js";
import { Generated } from "../../../decorators/Generated.js";
import { BeforePublish } from "../../../decorators/BeforePublish.js";
import { AfterPublish } from "../../../decorators/AfterPublish.js";
import { BeforeConsume } from "../../../decorators/BeforeConsume.js";
import { AfterConsume } from "../../../decorators/AfterConsume.js";
import { OnConsumeError } from "../../../decorators/OnConsumeError.js";

export type TckMessages = ReturnType<typeof createTckMessages>;

export const createTckMessages = (hookLog: Array<string>) => {
  @Message({ name: "TckBasicMessage" })
  class TckBasicMessage implements IMessage {
    @Field("string") body!: string;
  }

  @Topic((msg: any) => `routed.${msg.category}`)
  @Message({ name: "TckTopicMessage" })
  class TckTopicMessage implements IMessage {
    @Field("string") category!: string;
    @Field("string") body!: string;
  }

  @Retry({ maxRetries: 3, strategy: "constant", delay: 50 })
  @DeadLetter()
  @Message({ name: "TckRetryMessage" })
  class TckRetryMessage implements IMessage {
    @Field("string") data!: string;
  }

  @Retry({ maxRetries: 2, strategy: "exponential", delay: 30 })
  @Message({ name: "TckExponentialRetryMessage" })
  class TckExponentialRetryMessage implements IMessage {
    @Field("string") data!: string;
  }

  @Broadcast()
  @Message({ name: "TckBroadcastMessage" })
  class TckBroadcastMessage implements IMessage {
    @Field("string") body!: string;
  }

  // Broadcast + retry: exercises the retry-fanout contract on a @Broadcast type.
  // Every consumer receives the original publish; when ONE consumer's handler
  // fails, only that consumer must see the redelivery (retryConsumerTargeted).
  @Broadcast()
  @Retry({ maxRetries: 3, strategy: "constant", delay: 50 })
  @Message({ name: "TckBroadcastRetryMessage" })
  class TckBroadcastRetryMessage implements IMessage {
    @Field("string") data!: string;
  }

  @Expiry(200)
  @Message({ name: "TckExpiryMessage" })
  class TckExpiryMessage implements IMessage {
    @Field("string") body!: string;
  }

  @BeforePublish(() => {
    hookLog.push("beforePublish");
  })
  @AfterPublish(() => {
    hookLog.push("afterPublish");
  })
  @BeforeConsume(() => {
    hookLog.push("beforeConsume");
  })
  @AfterConsume(() => {
    hookLog.push("afterConsume");
  })
  @OnConsumeError((err: Error) => {
    hookLog.push(`error:${err.message}`);
  })
  @Message({ name: "TckHookMessage" })
  class TckHookMessage implements IMessage {
    @Field("string") body!: string;
  }

  // No @DeadLetter — retries only, no dead-letter sink
  @Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
  @Message({ name: "TckRetryNoDlqMessage" })
  class TckRetryNoDlqMessage implements IMessage {
    @Field("string") data!: string;
  }

  // ─── Retry version-skew pair (M2) ──────────────────────────────────────────
  // Two classes that resolve to the SAME topic but declare DIFFERENT @Retry.
  // The producer publishes with maxRetries=4 (on the wire); the consumer's local
  // @Retry says maxRetries=1. Retry policy must follow the producer's wire config
  // (5 deliveries), not the consumer's local decorator (would be 2) — identical
  // across every driver. Before M2, RabbitMQ re-derived policy from the consumer
  // metadata and diverged.
  @Retry({ maxRetries: 4, strategy: "constant", delay: 50 })
  @DeadLetter()
  @Topic(() => "iris.tck.retry.skew")
  @Message({ name: "TckSkewProducerMessage" })
  class TckSkewProducerMessage implements IMessage {
    @Field("string") data!: string;
  }

  @Retry({ maxRetries: 1, strategy: "constant", delay: 50 })
  @DeadLetter()
  @Topic(() => "iris.tck.retry.skew")
  @Message({ name: "TckSkewConsumerMessage" })
  class TckSkewConsumerMessage implements IMessage {
    @Field("string") data!: string;
  }

  @Message({ name: "TckRpcRequest" })
  class TckRpcRequest implements IMessage {
    @Field("string") question!: string;
  }

  @Message({ name: "TckRpcResponse" })
  class TckRpcResponse implements IMessage {
    @Field("string") answer!: string;
  }

  @Message({ name: "TckStreamInput" })
  class TckStreamInput implements IMessage {
    @Field("string") value!: string;
    @Field("integer") score!: number;
  }

  @Message({ name: "TckStreamOutput" })
  class TckStreamOutput implements IMessage {
    @Field("string") value!: string;
    @Field("integer") score!: number;
  }

  // Stream input that participates in retry + dead-letter. A pipeline stage that
  // throws on this input must redeliver (bounded by @Retry) then dead-letter —
  // it must NOT be silently dropped (H5, stream at-least-once contract).
  @Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
  @DeadLetter()
  @Message({ name: "TckStreamRetryInput" })
  class TckStreamRetryInput implements IMessage {
    @Field("string") value!: string;
    @Field("integer") score!: number;
  }

  // Poison-pill injection pair for streams. The pipeline consumes with
  // `TckStreamPoisonInput` (marked @Encrypted, so its deserialization REQUIRES an
  // encrypted payload) but reads the topic that `TckStreamPoisonFeed` publishes
  // PLAIN. The undeserializable (unencrypted-but-expected-encrypted) payload is a
  // poison pill: retrying is futile, so it must go straight to the dead letter —
  // never loop forever, never silently drop (H5).
  @Encrypted({ condition: { purpose: "message" } })
  @DeadLetter()
  @Message({ name: "TckStreamPoisonInput" })
  class TckStreamPoisonInput implements IMessage {
    @Field("string") value!: string;
    @Field("integer") score!: number;
  }

  @Message({ name: "TckStreamPoisonFeed" })
  class TckStreamPoisonFeed implements IMessage {
    @Field("string") value!: string;
    @Field("integer") score!: number;
  }

  @Encrypted({ condition: { purpose: "message" } })
  @Message({ name: "TckEncryptedMessage" })
  class TckEncryptedMessage implements IMessage {
    @IdentifierField()
    @Generated()
    id!: string;

    @TimestampField()
    createdAt!: Date;

    @Field("string") secretData!: string;
  }

  @Compressed("gzip")
  @Message({ name: "TckCompressedMessage" })
  class TckCompressedMessage implements IMessage {
    @IdentifierField()
    @Generated()
    id!: string;

    @TimestampField()
    createdAt!: Date;

    @Field("string") largePayload!: string;
  }

  @Message({ name: "TckHeaderMessage" })
  class TckHeaderMessage implements IMessage {
    @IdentifierField()
    @Generated()
    id!: string;

    @TimestampField()
    createdAt!: Date;

    @Field("string")
    @Header("x-trace-id")
    traceId!: string;

    @Field("string")
    @Header("x-user-id")
    userId!: string;

    @Field("string") body!: string;
  }

  // ─── Decorator-coverage messages ───────────────────────────────────────────

  @Message({ name: "TckTransformMessage" })
  class TckTransformMessage implements IMessage {
    @Transform({
      to: (value: unknown) => (value as string).toUpperCase(),
      from: (raw: unknown) => (raw as string).toLowerCase(),
    })
    @Field("string")
    label!: string;

    @Field("string") body!: string;
  }

  @OnCreate((msg: any) => {
    hookLog.push("onCreate");
    msg.touched = true;
  })
  @OnHydrate((msg: any) => {
    hookLog.push("onHydrate");
    msg.hydrated = true;
  })
  @OnValidate((msg: any) => {
    hookLog.push("onValidate");
  })
  @Message({ name: "TckLifecycleMessage" })
  class TckLifecycleMessage implements IMessage {
    @Schema(z.string().min(1))
    @Field("string")
    body!: string;
    @Default(false) @Field("boolean") touched!: boolean;
    @Default(false) @Field("boolean") hydrated!: boolean;
  }

  @Message({ name: "TckMandatoryPersistentMessage" })
  class TckMandatoryPersistentMessage implements IMessage {
    @Field("string") body!: string;
    @MandatoryField() mandatory!: boolean;
    @PersistentField() persistent!: boolean;
  }

  @Message({ name: "TckCorrelationMessage" })
  class TckCorrelationMessage implements IMessage {
    @CorrelationField() @Generated() correlationId!: string;
    @Field("string") body!: string;
  }

  @Namespace("ns")
  @Message({ name: "TckNamespacedMessage" })
  class TckNamespacedMessage implements IMessage {
    @Field("string") body!: string;
  }

  return {
    TckBasicMessage,
    TckTopicMessage,
    TckRetryMessage,
    TckExponentialRetryMessage,
    TckBroadcastMessage,
    TckBroadcastRetryMessage,
    TckExpiryMessage,
    TckHookMessage,
    TckRetryNoDlqMessage,
    TckSkewProducerMessage,
    TckSkewConsumerMessage,
    TckRpcRequest,
    TckRpcResponse,
    TckStreamInput,
    TckStreamOutput,
    TckStreamRetryInput,
    TckStreamPoisonInput,
    TckStreamPoisonFeed,
    TckEncryptedMessage,
    TckCompressedMessage,
    TckHeaderMessage,
    TckTransformMessage,
    TckLifecycleMessage,
    TckMandatoryPersistentMessage,
    TckCorrelationMessage,
    TckNamespacedMessage,
  };
};

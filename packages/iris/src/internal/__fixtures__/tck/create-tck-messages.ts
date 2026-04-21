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

  @Encrypted()
  @Message({ name: "TckEncryptedMessage" })
  class TckEncryptedMessage implements IMessage {
    @IdentifierField()
    @Generated("uuid")
    id!: string;

    @TimestampField()
    @Generated("date")
    createdAt!: Date;

    @Field("string") secretData!: string;
  }

  @Compressed("gzip")
  @Message({ name: "TckCompressedMessage" })
  class TckCompressedMessage implements IMessage {
    @IdentifierField()
    @Generated("uuid")
    id!: string;

    @TimestampField()
    @Generated("date")
    createdAt!: Date;

    @Field("string") largePayload!: string;
  }

  @Message({ name: "TckHeaderMessage" })
  class TckHeaderMessage implements IMessage {
    @IdentifierField()
    @Generated("uuid")
    id!: string;

    @TimestampField()
    @Generated("date")
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
    @CorrelationField() correlationId!: string;
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
    TckExpiryMessage,
    TckHookMessage,
    TckRetryNoDlqMessage,
    TckRpcRequest,
    TckRpcResponse,
    TckStreamInput,
    TckStreamOutput,
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

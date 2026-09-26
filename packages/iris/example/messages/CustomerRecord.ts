// zod is a required peer dependency of @lindorm/iris. @Encrypted additionally
// needs @lindorm/amphora and @lindorm/kryptos — optional peers, installed only
// when a message is encrypted.
import {
  Encrypted,
  Field,
  Message,
  Namespace,
  Schema,
  Sensitive,
} from "../../src/index.js";
import { z } from "zod";

// The key comes from the source's `encryption` default; a decorator that names
// one of its own overrides it.
@Message()
@Namespace("customers")
@Encrypted()
export class CustomerRecord {
  @Field("string") customerId!: string;

  @Sensitive() @Field("string") nationalId!: string;

  @Schema(z.object({ street: z.string(), city: z.string() }))
  @Field("object")
  address!: { street: string; city: string };
}

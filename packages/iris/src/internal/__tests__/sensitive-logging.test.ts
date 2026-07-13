// End-to-end proof that a @Sensitive value never reaches the LOGS — the claim the
// decorator makes, verified rather than asserted.
//
// MessageManager logged the whole message when creating, hydrating and validating it,
// so every field value of every command/event reached the logs in cleartext. This test
// holds the fix to a real source at the LOUDEST log level: it captures every line iris
// emits across a full publish/consume lifecycle and asserts the secret appears in none
// of them.
//
// MessageManager is driver-agnostic, so the memory driver exercises the very same
// create → publish → consume → hydrate → validate path the brokers do, with no docker.
//
// The `logs.length` assertion keeps it honest: it proves iris really was logging during
// the run, so a pass means "logged plenty, leaked nothing" rather than "logged nothing".

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IrisSource } from "../../classes/IrisSource.js";
import { Field } from "../../decorators/Field.js";
import { Generated } from "../../decorators/Generated.js";
import { Header } from "../../decorators/Header.js";
import { IdentifierField } from "../../decorators/IdentifierField.js";
import { Message } from "../../decorators/Message.js";
import { Sensitive } from "../../decorators/Sensitive.js";
import { waitFor } from "../__fixtures__/tck/wait.js";

vi.setConfig({ testTimeout: 30_000 });

const SECRET = "hunter2-super-secret-token";
const HEADER_SECRET = "Bearer hunter2-super-secret-authorization";
const PUBLIC_VALUE = "public-field-value";

// The one real digest the message carries — a @Sensitive digest field must still be
// redacted, even though its value is already a hash.
const SHA256_HASH = "9S-9MrKzuG_4jvbEkGKChfSCrxXdyylUH5S89Saj9sc";

@Message({ name: "SensitiveLoggingMessage" })
class SensitiveLoggingMessage {
  @IdentifierField()
  @Generated()
  id!: string;

  @Sensitive()
  @Field("string")
  apiToken!: string;

  @Sensitive({ digest: "sha256" })
  @Field("string")
  passwordHash!: string;

  // a header can carry an auth value — it must be redacted like any other field
  @Sensitive()
  @Header("authorization")
  @Field("string")
  authorization!: string;

  @Field("string")
  name!: string;
}

describe("@Sensitive: no value reaches the logs (memory)", () => {
  let source: IrisSource;
  let logs: Array<unknown>;

  const logged = (): string => JSON.stringify(logs);

  beforeEach(async () => {
    logs = [];

    source = new IrisSource({
      driver: "memory",
      messages: [SensitiveLoggingMessage],
      // capture EVERYTHING iris emits
      logger: createMockLogger((...args: Array<unknown>) => logs.push(args)),
    });

    await source.connect();
    await source.setup();
  });

  afterEach(async () => {
    await source.disconnect();
  });

  it("should not write a sensitive value to any log across a publish/consume lifecycle", async () => {
    const bus = source.messageBus(SensitiveLoggingMessage);
    const received: Array<SensitiveLoggingMessage> = [];

    await bus.subscribe({
      topic: "SensitiveLoggingMessage",
      callback: async (message) => {
        received.push(message);
      },
    });

    // create → validate → publish → consume → hydrate → validate
    const message = bus.create({
      apiToken: SECRET,
      passwordHash: SHA256_HASH,
      authorization: HEADER_SECRET,
      name: PUBLIC_VALUE,
    });

    await bus.publish(message);

    await waitFor(() => received.length >= 1, 10_000);

    // the message really did make the round trip with its values intact — redaction
    // touches the LOGS, never the message
    expect(received).toHaveLength(1);
    expect(received[0].apiToken).toBe(SECRET);
    expect(received[0].authorization).toBe(HEADER_SECRET);
    expect(received[0].passwordHash).toBe(SHA256_HASH);
    expect(message.apiToken).toBe(SECRET);

    // the run really did log, so the assertions below mean "logged plenty, leaked nothing"
    expect(logs.length).toBeGreaterThan(0);

    expect(logged()).not.toContain(SECRET);
    expect(logged()).not.toContain(HEADER_SECRET);
    expect(logged()).not.toContain(SHA256_HASH);

    // ... and the non-sensitive field was free to be logged
    expect(logged()).toContain(PUBLIC_VALUE);
  });
});

// TCK Runner
//
// Wires up all TCK suites with capability gating.
// Each driver harness calls runTck() with its factory.

import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../interfaces";
import type { TckCapabilities, TckDriverFactory, TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { createTckMessages } from "./create-tck-messages";

import { publishSubscribeSuite } from "./publish-subscribe.tck";
import { fanOutSuite } from "./fan-out.tck";
import { workerQueueSuite } from "./worker-queue.tck";
import { retryDeadLetterSuite } from "./retry-dead-letter.tck";
import { rpcSuite } from "./rpc.tck";
import { streamSuite } from "./stream.tck";
import { hooksSuite } from "./hooks.tck";
import { topicResolutionSuite } from "./topic-resolution.tck";
import { delaySuite } from "./delay.tck";
import { broadcastSuite } from "./broadcast.tck";
import { compressionSuite } from "./compression.tck";
import { encryptionSuite } from "./encryption.tck";
import { expirySuite } from "./expiry.tck";
import { headersSuite } from "./headers.tck";
import { decoratorCoverageSuite } from "./decorator-coverage.tck";
import { errorResilienceSuite } from "./error-resilience.tck";

const maybeDescribe = (flag: boolean, name: string, fn: () => void) => {
  if (flag) {
    describe(name, fn);
  }
};

export const runTck = (factory: TckDriverFactory) => {
  const hookLog: Array<string> = [];
  const messages = createTckMessages(hookLog);
  const caps = factory.capabilities;
  const timeoutMs = factory.timeoutMs ?? 10000;

  let handle: TckDriverHandle;

  const getHandle = () => handle;

  // Collect all message classes for setup
  const baseMessages: Array<Constructor<IMessage>> = [
    messages.TckBasicMessage,
    messages.TckTopicMessage,
    messages.TckHookMessage,
    messages.TckRetryMessage,
    messages.TckExponentialRetryMessage,
    messages.TckBroadcastMessage,
    messages.TckExpiryMessage,
    messages.TckRetryNoDlqMessage,
  ];

  if (caps.rpc) {
    baseMessages.push(messages.TckRpcRequest, messages.TckRpcResponse);
  }
  if (caps.stream) {
    baseMessages.push(messages.TckStreamInput, messages.TckStreamOutput);
  }
  if (caps.encryption) {
    baseMessages.push(messages.TckEncryptedMessage);
  }
  if (caps.compression) {
    baseMessages.push(messages.TckCompressedMessage);
  }

  // Headers are always-on (no special driver requirements)
  baseMessages.push(messages.TckHeaderMessage);

  // Decorator-coverage messages (always-on)
  baseMessages.push(
    messages.TckTransformMessage,
    messages.TckLifecycleMessage,
    messages.TckMandatoryPersistentMessage,
    messages.TckCorrelationMessage,
    messages.TckNamespacedMessage,
  );

  beforeAll(async () => {
    handle = await factory.setup(baseMessages);
  });

  afterAll(async () => {
    await handle.teardown();
  });

  // Always-on suites
  publishSubscribeSuite(getHandle, messages, timeoutMs);
  fanOutSuite(getHandle, messages, timeoutMs);
  topicResolutionSuite(getHandle, messages, timeoutMs);
  hooksSuite(getHandle, messages, hookLog, timeoutMs);

  // Capability-gated suites
  maybeDescribe(caps.workerQueue, "workerQueue", () =>
    workerQueueSuite(getHandle, messages, timeoutMs),
  );
  maybeDescribe(caps.retry, "retry", () =>
    retryDeadLetterSuite(getHandle, messages, timeoutMs, caps),
  );
  maybeDescribe(caps.rpc, "rpc", () => rpcSuite(getHandle, messages, timeoutMs));
  maybeDescribe(caps.stream, "stream", () => streamSuite(getHandle, messages, timeoutMs));
  maybeDescribe(caps.delay, "delay", () => delaySuite(getHandle, messages, timeoutMs));
  maybeDescribe(caps.broadcast, "broadcast", () =>
    broadcastSuite(getHandle, messages, timeoutMs),
  );
  maybeDescribe(caps.encryption, "encryption", () =>
    encryptionSuite(getHandle, messages, timeoutMs),
  );
  maybeDescribe(caps.compression, "compression", () =>
    compressionSuite(getHandle, messages, timeoutMs),
  );

  // Always-on: expiry, headers, decorator coverage, and error resilience require no special driver support
  expirySuite(getHandle, messages, timeoutMs);
  headersSuite(getHandle, messages, timeoutMs);
  decoratorCoverageSuite(getHandle, messages, hookLog, timeoutMs);
  errorResilienceSuite(getHandle, messages, timeoutMs, caps);
};

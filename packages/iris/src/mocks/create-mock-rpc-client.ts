import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisRpcClient, IMessage } from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { createMemoryIrisBackend } from "./mock-memory-backend.js";

/**
 * Build a mock RPC client backed by the REAL in-memory driver for the given
 * request/response `@Message` classes.
 *
 * A memory RPC client only resolves once a server serves the same pair on the
 * shared store. Pass `responseFactory` to stand up a real server that responds
 * via the factory — then `request()` completes a genuine in-process round-trip
 * and returns the factory's response. Without it, `request()` faithfully rejects
 * with `IrisTransportError` (no handler registered).
 *
 * Every method stays a spy — assert `client.request.mock.calls`, or override any
 * default with `mockResolvedValueOnce` etc.
 */
export const _createMockRpcClient = async <
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
>(
  mockFn: () => any,
  createLogger: () => ILogger,
  requestTarget: Constructor<Req>,
  responseTarget: Constructor<Res>,
  responseFactory?: (request: Req) => Res | Promise<Res>,
  settings?: CreateMockIrisSettings,
): Promise<IIrisRpcClient<Req, Res>> => {
  const backend = await createMemoryIrisBackend(mockFn, createLogger, {
    ...settings,
    messages: [requestTarget, responseTarget, ...(settings?.messages ?? [])],
  });
  return backend.makeFacadeRpcClient(requestTarget, responseTarget, responseFactory);
};

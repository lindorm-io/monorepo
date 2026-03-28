import type { IMessage } from "../interfaces/Message";
import type { IIrisRpcClient } from "../interfaces/IrisRpcClient";

export type MockRpcClient<
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
> = IIrisRpcClient<Req, Res> & {
  requests: Array<Req>;
  clearRequests(): void;
};

export const createMockRpcClient = <
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
>(
  responseFactory?: (req: Req) => Res | Promise<Res>,
): MockRpcClient<Req, Res> => {
  const requests: Array<Req> = [];

  return {
    requests,

    request: jest.fn(
      async (message: Req, _options?: { timeout?: number }): Promise<Res> => {
        requests.push(message);

        if (!responseFactory) {
          throw new Error(
            "MockRpcClient: no responseFactory provided — supply one via the constructor",
          );
        }

        return responseFactory(message);
      },
    ),

    close: jest.fn(async (): Promise<void> => {}),

    clearRequests: (): void => {
      requests.length = 0;
    },
  };
};

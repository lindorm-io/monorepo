import type { IIrisRpcClient } from "../interfaces/IrisRpcClient";
import type { IMessage } from "../interfaces/Message";

export type RpcClientExtras<Req extends IMessage> = {
  requests: Array<Req>;
  clearRequests(): void;
};

export const _createMockRpcClient = <
  Req extends IMessage = IMessage,
  Res extends IMessage = IMessage,
>(
  mockFn: () => any,
  responseFactory?: (req: Req) => Res | Promise<Res>,
): IIrisRpcClient<Req, Res> & RpcClientExtras<Req> => {
  const requests: Array<Req> = [];
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };

  return {
    requests,

    request: impl(async (message: Req): Promise<Res> => {
      requests.push(message);

      if (!responseFactory) {
        throw new Error(
          "MockRpcClient: no responseFactory provided — supply one via the constructor",
        );
      }

      return responseFactory(message);
    }),

    close: impl(async (): Promise<void> => {}),

    clearRequests: (): void => {
      requests.length = 0;
    },
  } as unknown as IIrisRpcClient<Req, Res> & RpcClientExtras<Req>;
};

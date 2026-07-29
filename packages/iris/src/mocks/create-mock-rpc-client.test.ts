import type { IMessage } from "../interfaces/index.js";
import { Field } from "../decorators/Field.js";
import { Message } from "../decorators/Message.js";
import { IrisTransportError } from "../errors/IrisTransportError.js";
import { createMockRpcClient } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

@Message({ name: "MockRpcRequest" })
class MockRpcRequest implements IMessage {
  @Field("string") question!: string;
}

@Message({ name: "MockRpcResponse" })
class MockRpcResponse implements IMessage {
  @Field("string") answer!: string;
}

const makeRequest = (question: string): MockRpcRequest => {
  const req = new MockRpcRequest();
  req.question = question;
  return req;
};

describe("createMockRpcClient", () => {
  it("should complete a real round-trip via the response factory", async () => {
    const client = await createMockRpcClient(
      MockRpcRequest,
      MockRpcResponse,
      (request) => {
        const response = new MockRpcResponse();
        response.answer = `answer to: ${request.question}`;
        return response;
      },
    );

    const response = await client.request(makeRequest("what is 2+2?"));

    expect(response).toBeInstanceOf(MockRpcResponse);
    expect(response.answer).toBe("answer to: what is 2+2?");
  });

  it("should support an async response factory", async () => {
    const client = await createMockRpcClient(
      MockRpcRequest,
      MockRpcResponse,
      async (request) => {
        const response = new MockRpcResponse();
        response.answer = `async-${request.question}`;
        return response;
      },
    );

    const response = await client.request(makeRequest("hello"));

    expect(response.answer).toBe("async-hello");
  });

  it("should record request calls on the spy", async () => {
    const client = await createMockRpcClient(
      MockRpcRequest,
      MockRpcResponse,
      (request) => {
        const response = new MockRpcResponse();
        response.answer = `answer to: ${request.question}`;
        return response;
      },
    );
    const request = makeRequest("hello");

    await client.request(request, { timeout: 5000 });

    expect(client.request).toHaveBeenCalledWith(request, { timeout: 5000 });
    expect(vi.isMockFunction(client.close)).toBe(true);
  });

  it("should faithfully reject when no server is registered", async () => {
    const client = await createMockRpcClient(MockRpcRequest, MockRpcResponse);

    await expect(client.request(makeRequest("nobody home"))).rejects.toThrow(
      IrisTransportError,
    );
  });
});

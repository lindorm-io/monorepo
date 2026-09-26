import { IrisSource } from "../src/index.js";
import { Logger } from "@lindorm/logger";
import { PriceRequest } from "./messages/PriceRequest.js";
import { PriceResponse } from "./messages/PriceResponse.js";

const source = new IrisSource({
  driver: "memory",
  logger: new Logger({ level: "warn", readable: true }),
  messages: [PriceRequest, PriceResponse],
});

await source.connect();
await source.setup();

const server = source.rpcServer(PriceRequest, PriceResponse);
const client = source.rpcClient(PriceRequest, PriceResponse);

await server.serve(async (request) => {
  const response = new PriceResponse();
  response.price = request.sku === "WIDGET-42" ? 19.5 : 0;
  response.currency = "EUR";
  return response;
});

const request = new PriceRequest();
request.sku = "WIDGET-42";

const response = await client.request(request, { timeout: 5_000 });

console.log("price        > ", response.price, response.currency);
console.log("rpcFastFail  > ", source.capabilities.rpcFastFail);

await client.close();
await server.unserveAll();
await source.drain();
await source.disconnect();

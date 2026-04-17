import type {
  PylonHandler,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "@lindorm/pylon";
import type { z, ZodType } from "zod/v4";

export type ServerHttpContext<Data = any> = PylonHttpContext<Data>;

export type ServerSocketContext<Payload = any> = PylonSocketContext<Payload>;

export type ServerHttpMiddleware<C extends ServerHttpContext = ServerHttpContext> =
  PylonHttpMiddleware<C>;

export type ServerSocketMiddleware<C extends ServerSocketContext = ServerSocketContext> =
  PylonSocketMiddleware<C>;

// TODO: extend Data / State / Payload here to match your application's shape.
export type ServerHandler<
  Schema extends ZodType = ZodType<any>,
  Body = any,
> = PylonHandler<ServerHttpContext<z.infer<Schema>>, Body>;

export type ServerSocketHandler<Schema extends ZodType = ZodType<any>> =
  PylonSocketMiddleware<ServerSocketContext<z.infer<Schema>>>;

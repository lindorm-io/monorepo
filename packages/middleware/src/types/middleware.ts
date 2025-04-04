export type Dispatch = (i: number) => Promise<void>;

export type Next = () => Promise<void>;

export type Middleware<Context> = (context: Context, next: Next) => Promise<void>;

export type ComposedMiddleware<Context> = (
  context: Context,
  next?: Next,
) => Promise<void>;

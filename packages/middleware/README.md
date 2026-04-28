# @lindorm/middleware

Framework-agnostic helper for composing an array of asynchronous middleware functions around a shared context object, in the style of Koa.

## Installation

```bash
npm install @lindorm/middleware
```

This package is **ESM-only**. It cannot be loaded with `require()`; use `import` from an ESM module or a TypeScript project configured for ESM output.

## Features

- Sequential composition of async middleware around a shared context
- Optional shallow-clone of the context so callers can opt out of mutation
- Re-entry guard: calling `next()` twice from the same middleware rejects with an error
- Errors thrown inside any middleware propagate out of the composed call
- Fully typed via a single generic `Context` parameter
- Zero runtime dependencies

## Usage

```ts
import { composeMiddleware, type Middleware } from "@lindorm/middleware";

type Ctx = { counter: number };

const addOne: Middleware<Ctx> = async (ctx, next) => {
  ctx.counter += 1;
  await next();
};

const multiply: Middleware<Ctx> = async (ctx) => {
  ctx.counter *= 10;
};

const input: Ctx = { counter: 1 };

const result = await composeMiddleware(input, [addOne, multiply]);

console.log(result.counter); // 20
console.log(input.counter); // 1 — input is not mutated by default
```

`composeMiddleware` returns the context that was passed through the chain. By default that is a shallow clone of the input, so the caller's original object is left untouched.

### Mutating the original context

Pass `useClone: false` to skip the clone and run the chain against the original object:

```ts
import { composeMiddleware, type Middleware } from "@lindorm/middleware";

type Ctx = { counter: number };

const addOne: Middleware<Ctx> = async (ctx, next) => {
  ctx.counter += 1;
  await next();
};

const ctx: Ctx = { counter: 1 };

await composeMiddleware(ctx, [addOne], { useClone: false });

console.log(ctx.counter); // 2
```

### Wrapping behaviour around `next()`

Middleware can run code before and after awaiting `next()`, mirroring the Koa "onion" model. The example below records timestamps on either side of the inner middleware:

```ts
import { composeMiddleware, type Middleware } from "@lindorm/middleware";

type Ctx = { startedAt?: number; finishedAt?: number };

const timer: Middleware<Ctx> = async (ctx, next) => {
  ctx.startedAt = Date.now();
  await next();
  ctx.finishedAt = Date.now();
};

const work: Middleware<Ctx> = async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
};

const result = await composeMiddleware<Ctx>({}, [timer, work]);
```

### Error propagation

An exception thrown in any middleware rejects the promise returned by `composeMiddleware`. Wrap the call in `try`/`catch` (or chain `.catch`) to handle it:

```ts
import { composeMiddleware, type Middleware } from "@lindorm/middleware";

const failing: Middleware<{}> = async () => {
  throw new Error("boom");
};

try {
  await composeMiddleware({}, [failing]);
} catch (err) {
  // err.message === "boom"
}
```

Calling `next()` more than once from the same middleware rejects the chain with `Error("next() called multiple times")`.

## API

### `composeMiddleware<Context>(context, middleware, options?) => Promise<Context>`

Runs `middleware` in order against `context` and resolves with the context that was passed through the chain.

- `context` — the object shared between every middleware in the chain.
- `middleware` — array of `Middleware<Context>` functions.
- `options.useClone` — when `true` (default) the chain runs against `Object.assign({}, context)`, leaving the original untouched. When `false` the chain mutates `context` directly.

### `type Middleware<Context>`

`(context: Context, next: Next) => Promise<void>` — the shape every middleware must implement. Awaiting `next()` yields control to the next middleware; omitting the call short-circuits the rest of the chain.

### `type Next`

`() => Promise<void>` — the callback passed to each middleware as its second argument.

### `type ComposedMiddleware<Context>`

`(context: Context, next?: Next) => Promise<void>` — the shape returned by an internal dispatcher. Useful as a type when storing or wrapping a fully composed chain.

### `type Dispatch`

`(i: number) => Promise<void>` — low-level dispatcher signature exposed for type-level interop.

## License

AGPL-3.0-or-later

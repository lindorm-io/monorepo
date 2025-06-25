# @lindorm/middleware

Ultra-light **middleware composition helper** inspired by
[Koa](https://koajs.com/) – but completely framework agnostic. It allows you to
run an array of asynchronous functions (middleware) sequentially while sharing a mutable
`context` object between them.

The package is fewer than 100 lines of code, has **zero runtime dependencies** and is fully
typed.

---

## Installation

```bash
npm install @lindorm/middleware
# or
yarn add @lindorm/middleware
```

---

## Usage

```ts
import { composeMiddleware, Middleware } from '@lindorm/middleware';

type Ctx = { counter: number };

const addOne: Middleware<Ctx> = async (ctx, next) => {
  ctx.counter += 1;
  await next();
};

const multiply: Middleware<Ctx> = async (ctx) => {
  ctx.counter *= 10;
};

const context: Ctx = { counter: 1 };

await composeMiddleware(context, [addOne, multiply]);

console.log(context.counter); // 1  (context is cloned by default!)
```

### Mutating the original context

By default the helper creates a **shallow clone** of the input context so the caller will not see
any mutations performed by the middleware chain. If you prefer to mutate the original object you
can disable cloning:

```ts
await composeMiddleware(context, [addOne, multiply], { useClone: false });

console.log(context.counter); // 20
```

---

## API

### `composeMiddleware(context, middleware[], options?) → Promise<Context>`

* **context** – any object that will be shared between middleware functions
* **middleware** – array of `Middleware<Context>`
* **options.useClone** – boolean (default `true`)

Each middleware receives two arguments:

```ts
type Middleware<Context> = (ctx: Context, next: () => Promise<void>) => Promise<void>;
```

Calling `await next()` transfers control to the next middleware in the chain. If you omit the call
the chain is short-circuited.

Error handling is delegated to the consumer – any uncaught exception thrown in a middleware will be
propagated back up the promise chain.

---

## TypeScript

The helper exports the following types so you can build fully typed middleware stacks:

* `Middleware<Ctx>`
* `Next` – the `() => Promise<void>` callback type
* `ComposedMiddleware<Ctx>` – low-level dispatcher type used internally

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE) file.


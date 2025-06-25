# @lindorm/postgres

Type-safe **PostgreSQL data-layer** that shares the same high-level contract as the Mongo / Redis /
Mnemos drivers.  It is built around a single `PostgresSource` which hides the raw `pg` (`Pool`)
client behind a clean, logger-aware facade and an expressive `PostgresQueryBuilder`.

---

## Features

* Simple **query helper** that converts template-literal style calls into parameterised SQL
* Chainable query builder for common CRUD operations (`select`, `insert`, `update`, `delete`)
* **Value serialisation** helpers – JSON & Date objects are converted automatically
* Built-in correlation & debug logging via `@lindorm/logger`
* Identical API shape to other Lindorm sources ⇒ easy driver swap in tests

---

## Installation

```bash
npm install @lindorm/postgres
# or
yarn add @lindorm/postgres
```

You’ll also need the [`pg`](https://www.npmjs.com/package/pg) native bindings (already included as a
dependency).

For local development a docker-compose file is provided:

```bash
docker compose -f ./packages/postgres/docker-compose.yml up -d
```

---

## Quick start

```ts
import { PostgresSource } from '@lindorm/postgres';
import { Logger } from '@lindorm/logger';

const source = new PostgresSource({
  url: 'postgres://user:pass@localhost:5432/app',
  logger: new Logger({ readable: true }),
});

// Parameterised raw query
const result = await source.query('SELECT * FROM users WHERE id = $1', ['u1']);

console.log(result.rows);

// Using the query builder
const qb = source.queryBuilder('users');

const { text, values } = qb.insert({ id: "98c0018f-51a4-568a-8588-ce8e8c4ffaef" })

await source.query(text, values);
```

---

## API surface (excerpt)

### `PostgresSource`

```ts
new PostgresSource({
  url?: string;                 // convenience wrapper, mutually exclusive with config
  config?: PoolConfig;          // forwarded to pg.Pool
  logger: ILogger;              // required
});

source.connect();      // no-op (Pool connects lazily)
source.disconnect();   // closes pool

source.query(sql, values?) → Promise<PostgresResult>
source.queryBuilder(table, opts?) → PostgresQueryBuilder
source.clone({ logger? }) → PostgresSource // shares underlying pool
```

`PostgresResult` maps the common parts of `pg.QueryResult` to a flatter structure `{ rows, rowCount
, fields }` for easier consumption.

### `PostgresQueryBuilder`

Chainable methods: `select`, `insert`, `update`, `delete`, `where`, `returning`, `orderBy`, `limit`
… – each call mutates the internal state and `build()` returns `{ sql, values }`.

---

## TypeScript

Full typings for source, builder and result objects are included.  Complex JSON / array types are
automatically serialised to strings when `stringifyComplexTypes` is `true` (default).

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).


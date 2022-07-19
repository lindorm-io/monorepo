# @lindorm-io/mongo

Mongo and Repository tools for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/mongo
```

## Usage

### Mongo Connection

```typescript
const connection = new MongoConnection({
  hostname: "db.location.com",
  port: 27000,
  auth: { user: "user", password: "password" },
  database: "database",
});

await connection.connect();

const db = connection.client.db("database");
const collection1 = db.collection("collectionName1");
const collection2 = db.collection("collectionName2");

await connection.disconnect();
```

### Repository

```typescript
class EntityRepository extends LindormRepository<EntityAttributes, Entity> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "entity_name",
      indices: [
        {
          index: { entity_attribute_key: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createEntity(data: EntityAttributes): Entity {
    return new Entity(data);
  }
}

const repository = new EntityRepository({
  connection,
  logger: winstonLogger,
});

await repository.create(entity);
await repository.update(entity);
const entity = await repository.find({ filter });
const [e1, e2] = await repository.findMany({ filter });
await repository.remove(entity);
await repository.removeMany({ filter });
```

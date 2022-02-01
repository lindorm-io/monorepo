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
  auth: { user: "user", password: "password" },
  databaseName: "database",
  hostname: "db.location.com",
  port: 27000,
  type: MongoConnectionType.MEMORY,
});

await connection.connect();
const client = connection.client();
const db = connection.database();

const collection1 = await connection.collection("collectionName1");
const collection2 = await db.collection("collectionName2");

await connection.close();
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
  db,
  logger: winstonLogger,
});

await repository.create(entity);
await repository.update(entity);
const entity = await repository.find({ filter });
await[(e1, e2)] = await repository.findMany({ filter });
await repository.remove(entity);
await repository.removeMany({ filter });
```

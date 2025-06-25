# @lindorm/entity

Decorator-based entity management system with ORM-like features, validation, relationships, and versioning support.

## Installation

```bash
npm install @lindorm/entity
```

## Features

- **Decorator-Based Configuration**: Define entities using TypeScript decorators
- **Automatic Field Management**: Built-in timestamp, version, and ID handling
- **Relationship Support**: One-to-One, One-to-Many, Many-to-One, Many-to-Many
- **Lifecycle Hooks**: OnCreate, OnUpdate, OnInsert, OnValidate, OnDestroy
- **Schema Validation**: Integrated Zod validation
- **Versioning**: Built-in entity versioning support
- **Auto-Generation**: Automatic value generation for fields
- **Type-Safe**: Full TypeScript support
- **Multi-Tenancy**: Scope column support
- **Soft Deletes**: Delete date column support

## Quick Start

### Basic Entity

```typescript
import { EntityBase, Column, Entity } from "@lindorm/entity";

@Entity()
export class User extends EntityBase {
  @Column("string")
  public email!: string;

  @Column("string")
  public name!: string;

  @Column("integer", { min: 0, max: 150 })
  public age!: number;

  @Column("boolean", { fallback: true })
  public isActive!: boolean;
}
```

### Using EntityKit

```typescript
import { EntityKit } from "@lindorm/entity";

const userKit = new EntityKit(User);

// Create new entity
const user = userKit.create({
  email: "john@example.com",
  name: "John Doe",
  age: 30
});

// Validate entity
await userKit.validate(user);

// Prepare for database insert
const insertData = await userKit.insert(user);
```

## Base Classes

### EntityBase

Abstract base class that provides:
- `id: string` - Primary key (UUID)
- `createdAt: Date` - Creation timestamp

```typescript
import { EntityBase, Entity, Column } from "@lindorm/entity";

@Entity()
export class Product extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("float", { min: 0 })
  public price!: number;
}
```

### VersionedEntityBase

Extends EntityBase with versioning support:
- `version: number` - Version number
- `versionId: string` - Unique version identifier
- `versionStartAt: Date` - When version became active
- `versionEndAt: Date | null` - When version ended

```typescript
import { VersionedEntityBase, Entity, Column } from "@lindorm/entity";

@Entity()
export class Document extends VersionedEntityBase {
  @Column("string")
  public content!: string;

  @Column("string")
  public author!: string;
}
```

## Decorators

### Entity Configuration

#### @Entity(options?)

```typescript
@Entity({
  name: "users",           // Collection/table name
  namespace: "auth",       // Database namespace
  database: "postgres",    // Database identifier
  cache: true             // Enable caching
})
export class User extends EntityBase {
  // ...
}
```

### Column Decorators

#### @Column(type?, options?)

```typescript
export class Product extends EntityBase {
  @Column("string", { 
    min: 1, 
    max: 255, 
    nullable: false 
  })
  public name!: string;

  @Column("float", { 
    min: 0, 
    fallback: 0 
  })
  public price!: number;

  @Column("array", { 
    fallback: [] 
  })
  public tags!: string[];

  @Column("enum", { 
    enum: ["active", "inactive", "pending"] 
  })
  public status!: string;

  @Column("email")
  public contactEmail!: string;

  @Column("url", { 
    nullable: true 
  })
  public website!: string | null;

  @Column("uuid")
  public externalId!: string;

  @Column("date", { 
    fallback: () => new Date() 
  })
  public publishedAt!: Date;

  @Column("object", { 
    optional: true 
  })
  public metadata?: Record<string, any>;
}
```

### Special Column Decorators

```typescript
export class Article extends EntityBase {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @CreateDateColumn()
  public readonly createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @DeleteDateColumn()
  public deletedAt!: Date | null;

  @ExpiryDateColumn()
  public expiresAt!: Date | null;

  @ScopeColumn()
  public tenantId!: string;

  @VersionColumn()
  public version!: number;
}
```

### Generated Values

```typescript
export class Order extends EntityBase {
  @Generated("uuid")
  public orderId!: string;

  @Generated("increment")
  public orderNumber!: number;

  @Generated("date")
  public orderDate!: Date;

  @Generated("integer", { min: 1000, max: 9999 })
  public confirmationCode!: number;

  @Generated("string", { length: 8, prefix: "ORD-" })
  public referenceCode!: string;

  @Generated("float", { min: 0, max: 1, decimals: 4 })
  public randomValue!: number;
}
```

### Indexes

```typescript
@Entity()
export class User extends EntityBase {
  @Column("string")
  @Index_({ unique: true })
  public email!: string;

  @Column("string")
  @Index_({ direction: "desc" })
  public lastName!: string;

  @Column("date")
  @Index_({ 
    name: "idx_created_date",
    direction: "desc",
    sparse: true
  })
  public createdAt!: Date;
}
```

### Validation

```typescript
import { z } from "zod";

@Entity()
@Schema(z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
  website: z.string().url().optional()
}))
export class User extends EntityBase {
  @Column("email")
  public email!: string;

  @Column("integer")
  public age!: number;

  @Column("url", { optional: true })
  public website?: string;
}
```

### Lifecycle Hooks

```typescript
@Entity()
@OnCreate((entity) => {
  entity.slug = entity.title.toLowerCase().replace(/\s+/g, '-');
})
@OnValidate((entity) => {
  if (entity.startDate > entity.endDate) {
    throw new Error("Start date must be before end date");
  }
})
@OnInsert((entity) => {
  console.log("Entity inserted:", entity.id);
})
@OnUpdate((entity) => {
  console.log("Entity updated:", entity.id);
})
@OnDestroy((entity) => {
  console.log("Entity destroyed:", entity.id);
})
export class Event extends EntityBase {
  @Column("string")
  public title!: string;

  @Column("string")
  public slug!: string;

  @Column("date")
  public startDate!: Date;

  @Column("date")
  public endDate!: Date;
}
```

## Relationships

### One-to-One

```typescript
@Entity()
export class User extends EntityBase {
  @OneToOne(() => Profile, "userId")
  public profile!: Profile;
}

@Entity()
export class Profile extends EntityBase {
  @Column("uuid")
  public userId!: string;

  @OneToOne(() => User, "id", true)
  public user!: User;
}
```

### One-to-Many & Many-to-One

```typescript
@Entity()
export class Author extends EntityBase {
  @OneToMany(() => Book, "authorId")
  public books!: Book[];
}

@Entity()
export class Book extends EntityBase {
  @Column("uuid")
  public authorId!: string;

  @ManyToOne(() => Author, "id", true)
  public author!: Author;
}
```

### Many-to-Many

```typescript
@Entity()
export class Student extends EntityBase {
  @ManyToMany(() => Course, "id", true, {
    joinTable: "student_courses"
  })
  public courses!: Course[];
}

@Entity()
export class Course extends EntityBase {
  @ManyToMany(() => Student, "id", true, {
    joinTable: "student_courses"
  })
  public students!: Student[];
}
```

### Relationship Options

```typescript
@Entity()
export class Order extends EntityBase {
  @OneToMany(() => OrderItem, "orderId", {
    loading: "eager",           // Load automatically
    onDelete: "cascade",        // Delete items when order deleted
    onUpdate: "cascade",        // Update items when order updated
    onOrphan: "delete",        // Delete orphaned items
    strategy: "join"           // Query strategy
  })
  public items!: OrderItem[];

  @ManyToOne(() => Customer, "id", true, {
    loading: "lazy",           // Load on demand
    nullable: true,            // Relationship is optional
    onDelete: "restrict"       // Prevent deletion if referenced
  })
  public customer?: Customer;
}
```

## EntityKit Usage

### Basic Operations

```typescript
const userKit = new EntityKit(User);

// Create entity
const user = userKit.create({
  email: "john@example.com",
  name: "John Doe"
});

// Copy entity
const userCopy = userKit.copy(existingUser);

// Validate
await userKit.validate(user);

// Prepare for insert
const insertData = await userKit.insert(user);

// Update entity
const updatedData = await userKit.update(user);

// Remove readonly fields
const writableData = userKit.removeReadonly(user);

// Verify readonly constraints
userKit.verifyReadonly(originalUser, modifiedUser);
```

### Versioned Entity Operations

```typescript
const docKit = new EntityKit(Document);

// Create new version
const newVersion = docKit.clone(existingDocument);

// Copy as new version
const versionCopy = docKit.versionCopy(original, modified);

// Update version end date
const closedVersion = docKit.versionUpdate(existingVersion);

// Get save strategy
const strategy = docKit.getSaveStrategy(document);
// Returns: "update" or "version"
```

### Metadata Access

```typescript
const kit = new EntityKit(User);

// Get collection name
const collection = kit.getCollectionName();
// Or with options
const collection2 = kit.getCollectionName({
  database: "postgres",
  namespace: "auth"
});

// Get increment sequence name
const sequence = kit.getIncrementName();
```

## EntityScanner

Automatically discover entities from the file system:

```typescript
import { EntityScanner } from "@lindorm/entity";

const scanner = new EntityScanner();

// Scan directories and files
const entities = await scanner.scan([
  "./src/entities",           // Directory path
  "./src/models/User.ts",     // File path
  Customer,                   // Entity constructor
]);

// entities is an array of entity constructors
for (const Entity of entities) {
  console.log(Entity.name);
}
```

## Advanced Examples

### Multi-Tenant Entity

```typescript
@Entity({ namespace: "tenant" })
export class TenantEntity extends EntityBase {
  @ScopeColumn()
  public tenantId!: string;

  @Column("string")
  public name!: string;
}

// Usage
const kit = new EntityKit(TenantEntity);
const entity = kit.create({
  tenantId: "tenant-123",
  name: "Product A"
});
```

### Soft Delete Pattern

```typescript
@Entity()
export class SoftDeletableEntity extends EntityBase {
  @Column("string")
  public name!: string;

  @DeleteDateColumn()
  public deletedAt!: Date | null;

  @Column("boolean", { fallback: false })
  public isDeleted!: boolean;
}

// Soft delete
entity.deletedAt = new Date();
entity.isDeleted = true;
```

### Complex Validation

```typescript
import { z } from "zod";

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string().regex(/^\d{5}$/),
  country: z.string().length(2)
});

@Entity()
@Schema(z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/),
  addresses: z.array(addressSchema).min(1)
}))
@OnValidate((entity) => {
  if (entity.addresses.length > 5) {
    throw new Error("Maximum 5 addresses allowed");
  }
})
export class Contact extends EntityBase {
  @Column("email")
  public email!: string;

  @Column("string")
  public phone!: string;

  @Column("array", { schema: addressSchema })
  public addresses!: Array<{
    street: string;
    city: string;
    zipCode: string;
    country: string;
  }>;
}
```

### Audit Trail with Versioning

```typescript
@Entity()
@PrimarySource("postgres")
export class AuditedDocument extends VersionedEntityBase {
  @Column("string")
  public title!: string;

  @Column("string")
  public content!: string;

  @Column("string")
  public modifiedBy!: string;

  @Column("string", { nullable: true })
  public changeReason!: string | null;
}

// Create new version
const kit = new EntityKit(AuditedDocument);
const newVersion = kit.clone(currentDocument);
newVersion.content = "Updated content";
newVersion.modifiedBy = "user-123";
newVersion.changeReason = "Typo correction";

const versionData = await kit.insert(newVersion);
```

### Custom Generated Values

```typescript
@Entity()
export class Invoice extends EntityBase {
  @Generated((entity) => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `INV-${year}${month}-${entity.invoiceNumber}`;
  })
  public invoiceId!: string;

  @Generated("increment")
  public invoiceNumber!: number;

  @Generated(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  })
  public dueDate!: Date;
}
```

## Type Definitions

### Column Types

- `array` - Array of values
- `bigint` - Large integers
- `boolean` - True/false
- `date` - Date/time values
- `email` - Email strings (validated)
- `enum` - Enumerated values
- `float` - Decimal numbers
- `integer` - Whole numbers
- `object` - JSON objects
- `string` - Text strings
- `url` - URL strings (validated)
- `uuid` - UUID strings (validated)

### Column Options

```typescript
interface ColumnOptions {
  enum?: string[];              // Allowed values
  fallback?: any | (() => any); // Default value
  max?: number;                 // Maximum value/length
  min?: number;                 // Minimum value/length
  nullable?: boolean;           // Can be null
  optional?: boolean;           // Can be undefined
  readonly?: boolean;           // Cannot be updated
  schema?: z.ZodType;          // Custom Zod schema
  type?: ColumnType;           // Override type
}
```

## Error Handling

```typescript
import { 
  EntityMetadataError, 
  EntityScannerError, 
  EntityUtilityError 
} from "@lindorm/entity";

try {
  await kit.validate(entity);
} catch (error) {
  if (error instanceof EntityMetadataError) {
    // Metadata configuration error
  } else if (error instanceof EntityUtilityError) {
    // Validation or utility error
  }
}
```

## Best Practices

1. **Always extend base classes** - Use EntityBase or VersionedEntityBase
2. **Use appropriate column types** - Match database types
3. **Add validation** - Use @Schema and @OnValidate decorators
4. **Handle relationships carefully** - Consider loading strategies
5. **Use EntityKit** - For all entity operations
6. **Implement soft deletes** - For data retention
7. **Version sensitive data** - Use VersionedEntityBase for audit trails
8. **Index frequently queried fields** - Use @Index_ decorator
9. **Set appropriate defaults** - Use fallback option
10. **Validate early** - Call validate() before persistence

## License

AGPL-3.0-or-later

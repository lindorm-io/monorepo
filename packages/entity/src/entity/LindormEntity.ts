import { EntityAttributes, EntityOptions, ILindormEntity } from "../types";
import { EntityBase } from "./EntityBase";

export abstract class LindormEntity<Attributes extends EntityAttributes>
  extends EntityBase
  implements ILindormEntity<Attributes>
{
  protected constructor(options: EntityOptions = {}) {
    super(options);
  }

  public abstract schemaValidation(): Promise<void>;

  public abstract toJSON(): Attributes;
}

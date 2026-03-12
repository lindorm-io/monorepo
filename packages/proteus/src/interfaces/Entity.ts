/**
 * Base interface for all Proteus entities.
 *
 * Every entity class must satisfy this interface. Concrete entities add
 * typed fields via decorators; the index signature allows dynamic access
 * within the ORM internals.
 */
export interface IEntity {
  [key: string]: any;
}

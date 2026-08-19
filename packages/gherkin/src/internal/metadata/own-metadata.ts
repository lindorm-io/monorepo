/**
 * A class's OWN metadata level, or `undefined` when the class carries none.
 * `getOwnPropertyDescriptor`, never a property read: `Symbol.metadata` is a
 * static, so an undecorated subclass inherits it through the constructor
 * chain and a direct read would attribute the parent's level to the subclass.
 */
export const getOwnMetadata = (target: object): DecoratorMetadataObject | undefined =>
  Object.getOwnPropertyDescriptor(
    target,
    (Symbol as { metadata?: symbol }).metadata as symbol,
  )?.value as DecoratorMetadataObject | undefined;

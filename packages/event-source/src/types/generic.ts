export type Attributes = Record<string, any>;
export type Data = Record<string, any>;
export type Constructor<Type> = new (...args: any) => Type;
export type DtoClass = { constructor: { name: string } };
export type Metadata = Record<string, any>;
export type State = Record<string, any>;

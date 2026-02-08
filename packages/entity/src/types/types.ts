export type IndexDirection =
  | "asc"
  | "desc"
  | "2d"
  | "2dsphere"
  | "geoHaystack"
  | "hashed"
  | "text";

export type TypedPropertyDecorator<T> = (target: T, propertyKey: string) => void;

export type ClassLike = { constructor: { name: string } };

export type Constructor<T> = new (...args: any) => T;

export type Dict<T = any> = Record<string, T>;

export type Function<T = any> = (...args: any[]) => T;

export type Header = string | number | boolean;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type Param = string | number | boolean | Array<string | number | boolean>;

export type Query = string | number | boolean | Array<string | number | boolean>;

export type ReverseMap<T> = T[keyof T];

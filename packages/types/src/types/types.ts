export type ClassLike<T = any> = InstanceType<Constructor<T>>;

export type Constructor<T = any> = new (...args: any) => T;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Dict<T = any> = Record<string, T>;

export type Function<T = any> = (...args: any[]) => T;

export type Header = string | number | boolean;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type Param = string | number | boolean | Array<string | number | boolean>;

export type Query = string | number | boolean | Array<string | number | boolean>;

export type ReverseMap<T> = T[keyof T];

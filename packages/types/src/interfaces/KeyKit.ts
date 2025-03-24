export interface IKeyKit {
  sign(data: string): string;
  verify(data: string, signature: string): boolean;
  assert(data: string, signature: string): void;
}

export const listUsers = async (_ctx: any, next: any) => {
  await next();
};
export const createUserSchema = async (_ctx: any, next: any) => {
  await next();
};
export const createUser = async (_ctx: any, next: any) => {
  await next();
};

export const GET = listUsers;
export const POST = [createUserSchema, createUser];

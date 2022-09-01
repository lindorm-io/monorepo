import { GetViewById } from "./get-view-by-id.query";
import { QueryHandler } from "../../src";

const main: QueryHandler<GetViewById, unknown> = {
  query: GetViewById,
  view: "postgres_greetings",
  handler: (ctx) => ctx.repositories.postgres.findById(ctx.query.id),
};
export default main;

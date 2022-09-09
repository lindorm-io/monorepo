import { GetViewFromMongo } from "./get-view-from-mongo.query";
import { QueryHandler } from "../../src";

const main: QueryHandler<GetViewFromMongo, unknown> = {
  query: GetViewFromMongo,
  view: "mongo_greetings",
  handler: (ctx) => ctx.repositories.mongo.findById(ctx.query.id),
};
export default main;

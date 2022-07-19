import { TenantAttributes, Tenant } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class TenantRepository extends LindormRepository<TenantAttributes, Tenant> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "tenant",
      indices: [],
    });
  }

  protected createEntity(data: TenantAttributes): Tenant {
    return new Tenant(data);
  }
}

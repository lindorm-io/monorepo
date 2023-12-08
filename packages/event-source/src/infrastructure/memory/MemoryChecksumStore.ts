import { ChecksumStoreAttributes, ChecksumStoreFindFilter, IChecksumStore } from "../../types";
import { IN_MEMORY_CHECKSUM_STORE } from "./in-memory";

export class MemoryChecksumStore implements IChecksumStore {
  public async find(filter: ChecksumStoreFindFilter): Promise<ChecksumStoreAttributes | undefined> {
    return this.findInStore(filter);
  }

  public async insert(attributes: ChecksumStoreAttributes): Promise<void> {
    const found = this.findInStore(attributes);

    if (found) {
      throw new Error("Checksum already exists");
    }

    IN_MEMORY_CHECKSUM_STORE.push(attributes);
  }

  // private

  private findInStore(filter: ChecksumStoreFindFilter): ChecksumStoreAttributes | undefined {
    return IN_MEMORY_CHECKSUM_STORE.find(
      (x) =>
        x.id === filter.id &&
        x.name === filter.name &&
        x.context === filter.context &&
        x.event_id === filter.event_id,
    );
  }
}

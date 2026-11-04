import { Tags } from "../domain/tags";
import type { EnsureTagResult } from "../domain/tags";

export class Core {
  readonly #tags = new Tags();

  ensureTag(key: string, name: string): EnsureTagResult {
    return this.#tags.ensureTag(key, name);
  }
}

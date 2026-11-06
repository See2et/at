import { Objects } from "../domain/objects";
import type {
  AtObject,
  GetObjectResult,
  GetTagAttachmentResult,
  AttachTagResult,
  UpdateTagPropertiesResult,
} from "../domain/objects";
import type { PropertyType, PropertyInput, EnsureTagPropertyResult } from "../domain/properties";
import { Tags } from "../domain/tags";
import type { EnsureTagResult } from "../domain/tags";

import { query } from "../domain/query";
import type { QueryOptions, QueryResult } from "../domain/query";

export class Core {
  readonly #tags = new Tags();
  readonly #objects = new Objects(this.#tags);

  query(options: QueryOptions = {}): QueryResult {
    return query(this.#objects.snapshot(), options, this.#tags);
  }

  ensureTag(key: string, name: string): EnsureTagResult {
    return this.#tags.ensureTag(key, name);
  }

  createObject(title: string, body = ""): AtObject {
    return this.#objects.create(title, body);
  }

  getObject(id: string): GetObjectResult {
    return this.#objects.get(id);
  }

  ensureTagProperty(tagKey: string, key: string, type: PropertyType): EnsureTagPropertyResult {
    return this.#tags.ensureProperty(tagKey, key, type);
  }

  attachTag(objectId: string, tagKey: string, initialValues: PropertyInput = {}): AttachTagResult {
    return this.#objects.attach(objectId, tagKey, initialValues);
  }

  getTagAttachment(objectId: string, tagKey: string): GetTagAttachmentResult {
    return this.#objects.getAttachment(objectId, tagKey);
  }

  updateTagProperties(
    objectId: string,
    tagKey: string,
    values: PropertyInput,
  ): UpdateTagPropertiesResult {
    return this.#objects.updateProperties(objectId, tagKey, values);
  }
}

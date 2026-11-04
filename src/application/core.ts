import { Objects } from "../domain/objects";
import type {
  AtObject,
  GetObjectResult,
  GetTagAttachmentResult,
  AttachTagResult,
  UpdateTagPropertiesResult,
} from "../domain/objects";
import type { PropertyType, PropertyValues, EnsureTagPropertyResult } from "../domain/properties";
import { Tags } from "../domain/tags";
import type { EnsureTagResult } from "../domain/tags";

export class Core {
  readonly #tags = new Tags();
  readonly #objects = new Objects(this.#tags);

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

  attachTag(objectId: string, tagKey: string, initialValues: PropertyValues = {}): AttachTagResult {
    return this.#objects.attach(objectId, tagKey, initialValues);
  }

  getTagAttachment(objectId: string, tagKey: string): GetTagAttachmentResult {
    return this.#objects.getAttachment(objectId, tagKey);
  }

  updateTagProperties(
    objectId: string,
    tagKey: string,
    values: PropertyValues,
  ): UpdateTagPropertiesResult {
    return this.#objects.updateProperties(objectId, tagKey, values);
  }
}

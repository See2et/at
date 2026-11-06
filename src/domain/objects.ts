import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import type { Tag, Tags } from "./tags";
import type {
  PropertyInput,
  PropertyValueError,
  PropertyValues,
  TagNotFoundError,
} from "./properties";

export type AtObject = Readonly<{ id: string; title: string; body: string }>;
export type QueryItem = Readonly<{
  object: AtObject;
  attachments: readonly Readonly<{ tag: Tag; properties: PropertyValues }>[];
}>;
export type TagAttachment = Readonly<{
  objectId: string;
  tagKey: string;
  properties: PropertyValues;
}>;
export type ObjectNotFoundError = Readonly<{ type: "object-not-found" }>;
export type TagNotAttachedError = Readonly<{ type: "tag-not-attached" }>;
export type GetObjectResult = Result<AtObject, ObjectNotFoundError>;
export type AttachmentLookupError = ObjectNotFoundError | TagNotFoundError | TagNotAttachedError;
export type GetTagAttachmentResult = Result<TagAttachment, AttachmentLookupError>;
export type AlreadyAttachedError = Readonly<{
  type: "tag-already-attached";
  attachment: TagAttachment;
}>;
export type AttachTagResult = Result<
  TagAttachment,
  ObjectNotFoundError | PropertyValueError | AlreadyAttachedError
>;
export type UpdateTagPropertiesResult = Result<
  TagAttachment,
  AttachmentLookupError | PropertyValueError
>;

type ObjectState = { object: AtObject; attachments: Map<string, TagAttachment> };

export class Objects {
  readonly #objects = new Map<string, ObjectState>();
  #nextId = 1;

  constructor(private readonly tags: Tags) {}

  create(title: string, body: string): AtObject {
    const object = Object.freeze({ id: `object-${this.#nextId++}`, title, body });
    this.#objects.set(object.id, { object, attachments: new Map() });
    return object;
  }

  snapshot(): readonly QueryItem[] {
    return Object.freeze(
      Array.from(this.#objects.values(), ({ object, attachments }) =>
        Object.freeze({
          object,
          attachments: Object.freeze(
            Array.from(attachments.values(), (attachment) =>
              Object.freeze({
                tag: this.tags.get(attachment.tagKey)!,
                properties: attachment.properties,
              }),
            ),
          ),
        }),
      ),
    );
  }

  get(id: string): GetObjectResult {
    const state = this.#objects.get(id);
    return state === undefined ? err({ type: "object-not-found" }) : ok(state.object);
  }

  #findObjectForTag(
    objectId: string,
    tagKey: string,
  ): Result<ObjectState, ObjectNotFoundError | TagNotFoundError> {
    const state = this.#objects.get(objectId);
    if (state === undefined) return err({ type: "object-not-found" });
    if (!this.tags.has(tagKey)) return err({ type: "tag-not-found" });
    return ok(state);
  }

  getAttachment(objectId: string, tagKey: string): GetTagAttachmentResult {
    const found = this.#findObjectForTag(objectId, tagKey);
    if (found.isErr()) return err(found.error);
    const attachment = found.value.attachments.get(tagKey);
    return attachment === undefined ? err({ type: "tag-not-attached" }) : ok(attachment);
  }

  attach(objectId: string, tagKey: string, initialValues: PropertyInput): AttachTagResult {
    const found = this.#findObjectForTag(objectId, tagKey);
    if (found.isErr()) return err(found.error);
    const existing = found.value.attachments.get(tagKey);
    if (existing !== undefined) {
      return err({ type: "tag-already-attached", attachment: existing });
    }
    const validated = this.tags.applyValues(tagKey, initialValues);
    if (validated.isErr()) return err(validated.error);
    const attachment = Object.freeze({ objectId, tagKey, properties: validated.value });
    found.value.attachments.set(tagKey, attachment);
    return ok(attachment);
  }

  updateProperties(
    objectId: string,
    tagKey: string,
    values: PropertyInput,
  ): UpdateTagPropertiesResult {
    const found = this.#findObjectForTag(objectId, tagKey);
    if (found.isErr()) return err(found.error);
    const existing = found.value.attachments.get(tagKey);
    if (existing === undefined) return err({ type: "tag-not-attached" });
    const validated = this.tags.applyValues(tagKey, values, existing.properties);
    if (validated.isErr()) return err(validated.error);
    const attachment = Object.freeze({ objectId, tagKey, properties: validated.value });
    found.value.attachments.set(tagKey, attachment);
    return ok(attachment);
  }
}

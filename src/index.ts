export { Core } from "./application/core";
export type { EnsureTagResult, Tag } from "./domain/tags";
export type {
  PropertyType,
  PropertyValue,
  PropertyValues,
  TagProperty,
  TagNotFoundError,
  PropertyDefinitionError,
  PropertyValueError,
  EnsureTagPropertyResult,
} from "./domain/properties";
export type {
  AtObject,
  TagAttachment,
  ObjectNotFoundError,
  TagNotAttachedError,
  AttachmentLookupError,
  AlreadyAttachedError,
  GetObjectResult,
  GetTagAttachmentResult,
  AttachTagResult,
  UpdateTagPropertiesResult,
} from "./domain/objects";

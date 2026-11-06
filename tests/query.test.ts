import { describe, expect, it } from "vitest";
import { Core } from "../src/index";
import type { QueryOptions, QueryPage, QuerySort } from "../src/index";

function taskCore() {
  const core = new Core();
  core.ensureTag("task", "Tasks")._unsafeUnwrap();
  core.ensureTagProperty("task", "priority", "number")._unsafeUnwrap();
  core.ensureTagProperty("task", "memo", "string")._unsafeUnwrap();
  return core;
}

const priority = (op: "eq" | "gt" | "gte" | "lt" | "lte", value: number | null) => ({
  tagKey: "task",
  propertyKey: "priority",
  op,
  value,
});

const titles = (core: Core, options: QueryOptions = {}) =>
  core
    .query(options)
    ._unsafeUnwrap()
    .items.map((item) => item.object.title);

describe("query through the public SDK", () => {
  it("filters within a Tag, returns all Tags, and walks the whole multi-sorted result", () => {
    const core = taskCore();
    core.ensureTag("notes", "Notes")._unsafeUnwrap();
    core.ensureTagProperty("notes", "priority", "number")._unsafeUnwrap();
    const objects = Array.from({ length: 11 }, (_, i) => core.createObject(String(i + 1)));
    const first = objects[0]!;
    core.attachTag(first.id, "task", { priority: 3, memo: "z" })._unsafeUnwrap();
    core.attachTag(first.id, "notes", { priority: 99 })._unsafeUnwrap();
    core.attachTag(objects[1]!.id, "task", { priority: 5, memo: "b" })._unsafeUnwrap();
    core.attachTag(objects[9]!.id, "task", { priority: 5, memo: "b" })._unsafeUnwrap();
    core.attachTag(objects[10]!.id, "task", { priority: 5, memo: "a" })._unsafeUnwrap();
    core.attachTag(objects[2]!.id, "notes", { priority: 100 })._unsafeUnwrap();
    const filter = priority("gte", 3);
    const sort: readonly QuerySort[] = [
      { tagKey: "task", propertyKey: "priority", direction: "desc" },
      { tagKey: "task", propertyKey: "memo", direction: "asc" },
    ];
    expect(titles(core, { filter, sort })).toEqual(["11", "10", "2", "1"]);
    const visited: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: QueryPage = core.query({ filter, sort, offset, limit: 1 })._unsafeUnwrap();
      visited.push(...page.items.map((item) => item.object.title));
      offset = page.nextOffset;
    }
    expect(visited).toEqual(["11", "10", "2", "1"]);
    expect(core.query({ filter, sort, offset: 3, limit: 1 })._unsafeUnwrap()).toEqual({
      items: [
        {
          object: first,
          attachments: [
            { tag: { key: "task", name: "Tasks" }, properties: { priority: 3, memo: "z" } },
            { tag: { key: "notes", name: "Notes" }, properties: { priority: 99 } },
          ],
        },
      ],
      nextOffset: null,
    });
  });

  it("distinguishes absent Tags, unset, zero and empty strings, including whole-condition NOT", () => {
    const core = taskCore();
    const unset = core.createObject("unset");
    const zero = core.createObject("zero");
    const high = core.createObject("high");
    core.createObject("bare");
    core.attachTag(unset.id, "task")._unsafeUnwrap();
    core.attachTag(zero.id, "task", { priority: 0, memo: "" })._unsafeUnwrap();
    core.attachTag(high.id, "task", { priority: 5, memo: "x" })._unsafeUnwrap();
    expect(titles(core, { filter: { tagKey: "task" } })).toEqual(["unset", "zero", "high"]);
    expect(titles(core, { filter: priority("eq", null) })).toEqual(["unset"]);
    expect(titles(core, { filter: { not: priority("gt", 0) } })).toEqual(["unset", "zero", "bare"]);
    expect(
      titles(core, { filter: { and: [{ tagKey: "task" }, { not: priority("eq", null) }] } }),
    ).toEqual(["zero", "high"]);
    expect(
      titles(core, {
        filter: {
          and: [
            priority("gte", 0),
            priority("lte", 0),
            { tagKey: "task", propertyKey: "memo", op: "eq", value: "" },
          ],
        },
      }),
    ).toEqual(["zero"]);
    expect(titles(core, { filter: { or: [priority("lt", 1), priority("eq", null)] } })).toEqual([
      "unset",
      "zero",
    ]);
    expect(
      titles(core, { filter: { tagKey: "task", propertyKey: "memo", op: "gt", value: "a" } }),
    ).toEqual(["high"]);
    expect(
      titles(core, { sort: [{ tagKey: "task", propertyKey: "priority", direction: "asc" }] }),
    ).toEqual(["unset", "bare", "zero", "high"]);
    expect(
      titles(core, { sort: [{ tagKey: "task", propertyKey: "priority", direction: "desc" }] }),
    ).toEqual(["high", "zero", "unset", "bare"]);
  });

  it("defaults to ID string order and 20 results, accepts limits above 100, and marks empty/end pages", () => {
    const core = new Core();
    core.ensureTag("empty", "Empty")._unsafeUnwrap();
    const objects = Array.from({ length: 105 }, (_, i) => core.createObject(String(i)));
    const ids = objects.map((object) => object.id).sort();
    const first = core.query()._unsafeUnwrap();
    expect(first.items.map((item) => item.object.id)).toEqual(ids.slice(0, 20));
    expect(first.nextOffset).toBe(20);
    expect(core.query({ sort: [], offset: 100, limit: 101 })._unsafeUnwrap()).toEqual({
      items: objects
        .filter((object) => ids.slice(100).includes(object.id))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((object) => ({ object, attachments: [] })),
      nextOffset: null,
    });
    expect(core.query({ limit: 101 })._unsafeUnwrap().items).toHaveLength(101);
    expect(core.query({ offset: 105 })._unsafeUnwrap()).toEqual({ items: [], nextOffset: null });
    expect(core.query({ filter: { tagKey: "empty" } })._unsafeUnwrap()).toEqual({
      items: [],
      nextOffset: null,
    });
  });

  it("rejects invalid input as Result without executing functions or changing state", () => {
    const core = taskCore();
    const object = core.createObject("unchanged");
    let executed = false;
    const fn = () => {
      executed = true;
      return true;
    };
    const invalid: unknown[] = [
      ...[-1, 0.5, NaN, Infinity, -Infinity].map((offset) => ({ offset })),
      ...[0, -1, 0.5, NaN, Infinity, -Infinity].map((limit) => ({ limit })),
      { filter: null },
      { filter: [] },
      { filter: {} },
      { filter: { and: [] } },
      { filter: { or: [] } },
      { filter: { and: {} } },
      { filter: { not: null } },
      { filter: { tagKey: "task", not: { tagKey: "task" } } },
      { filter: { tagKey: "task", propertyKey: "priority", op: "in", value: [3] } },
      { filter: { tagKey: "task", propertyKey: "priority", op: "eq", value: "3" } },
      { filter: { tagKey: "task", propertyKey: "priority", op: "eq", value: Infinity } },
      { filter: { tagKey: "task", propertyKey: "priority", op: "eq", value: {} } },
      { filter: { tagKey: "task", propertyKey: "memo", op: "eq", value: 3 } },
      { filter: priority("gt", null) },
      { filter: fn },
      { filter: { tagKey: "task", propertyKey: "priority", op: "eq", value: fn } },
      { filter: { $where: fn } },
      { filter: { "object.title": "unchanged" } },
      { sort: {} },
      { sort: [null] },
      { sort: [{ tagKey: "task", propertyKey: "priority", direction: "up" }] },
      { sort: [{ tagKey: "task", direction: "asc" }] },
    ];
    for (const options of invalid) {
      expect(core.query(options as QueryOptions).isErr(), JSON.stringify(options)).toBe(true);
    }
    expect(executed).toBe(false);
    expect(core.query()._unsafeUnwrap()).toEqual({
      items: [{ object, attachments: [] }],
      nextOffset: null,
    });
    expect(core.getTagAttachment(object.id, "task").isErr()).toBe(true);
  });

  it("prevalidates definitions even with no Objects or short-circuit branches, explaining how to repair input", () => {
    const core = taskCore();
    const cases: [unknown, string[]][] = [
      [{ filter: { tagKey: "absent" } }, ["filter.tagKey", "absent", "registered", "ensureTag"]],
      [
        { filter: { tagKey: "task", propertyKey: "absent", op: "eq", value: null } },
        ["filter.propertyKey", "absent", "task", "ensureTagProperty"],
      ],
      [
        { filter: { and: [{ tagKey: "task" }, { ...priority("eq", 3), value: "3" }] } },
        ["filter.and[1].value", "number", "string", "3"],
      ],
      [
        { filter: { or: [{ tagKey: "task" }, { tagKey: "absent" }] } },
        ["filter.or[1].tagKey", "absent", "registered"],
      ],
      [{ filter: priority("gt", null) }, ["filter.value", "null", "eq"]],
      [{ filter: { and: [] } }, ["filter.and", "at least one", "omit filter"]],
      [
        { sort: [{ tagKey: "absent", propertyKey: "priority", direction: "asc" }] },
        ["sort[0].tagKey", "absent", "ensureTag"],
      ],
      [
        { sort: [{ tagKey: "task", propertyKey: "absent", direction: "asc" }] },
        ["sort[0].propertyKey", "absent", "ensureTagProperty"],
      ],
      [
        { sort: [{ tagKey: "task", propertyKey: "priority", direction: "up" }] },
        ["sort[0].direction", "asc", "desc", "up"],
      ],
    ];
    for (const populated of [false, true]) {
      if (populated) {
        const object = core.createObject("attached");
        core.attachTag(object.id, "task")._unsafeUnwrap();
      }
      for (const [options, fragments] of cases) {
        const error = core.query(options as QueryOptions)._unsafeUnwrapErr();
        expect(error.type).toBe("invalid-query");
        for (const fragment of fragments) expect(error.message).toContain(fragment);
      }
    }
  });

  it("freezes complete snapshots, preserves prior results after updates, and isolates Cores", () => {
    const core = taskCore();
    const object = core.createObject("original", "body");
    const input = { priority: 3, memo: "before" };
    core.attachTag(object.id, "task", input)._unsafeUnwrap();
    const filter = priority("gte", 3);
    const page = core.query({ filter })._unsafeUnwrap();
    input.priority = 99;
    filter.tagKey = "other";
    const item = page.items[0]!;
    expect(Reflect.set(page, "nextOffset", 0)).toBe(false);
    expect(Reflect.set(page.items, "0", {})).toBe(false);
    expect(Reflect.set(item, "object", {})).toBe(false);
    expect(Reflect.set(item.object, "title", "changed")).toBe(false);
    expect(Reflect.set(item.attachments, "0", {})).toBe(false);
    expect(Reflect.set(item.attachments[0]!, "tag", {})).toBe(false);
    expect(Reflect.set(item.attachments[0]!.tag, "name", "changed")).toBe(false);
    expect(Reflect.set(item.attachments[0]!.properties, "priority", 99)).toBe(false);
    core.updateTagProperties(object.id, "task", { priority: 4 })._unsafeUnwrap();
    expect(item.attachments[0]!.properties).toEqual({ priority: 3, memo: "before" });
    expect(core.query()._unsafeUnwrap().items[0]!.attachments[0]!.properties.priority).toBe(4);
    const other = new Core();
    expect(other.query()._unsafeUnwrap()).toEqual({ items: [], nextOffset: null });
    other.createObject("separate");
    expect(titles(core)).toEqual(["original"]);
  });

  it("stores, filters, sorts and unsets literal special keys without reading inherited members", () => {
    const core = new Core();
    const tagKey = "__proto__";
    core.ensureTag(tagKey, "Literal Tag")._unsafeUnwrap();
    const keys = ["__proto__", "constructor", "toString", "a.b", "$value", "a.__proto__.b"];
    for (const key of keys) core.ensureTagProperty(tagKey, key, "number")._unsafeUnwrap();
    const first = core.createObject("first");
    const second = core.createObject("second");
    const input = Object.fromEntries(keys.map((key) => [key, 2]));
    core.attachTag(first.id, tagKey, input)._unsafeUnwrap();
    core.attachTag(second.id, tagKey, { "a.b": 1 })._unsafeUnwrap();
    const before = core.query()._unsafeUnwrap();
    for (const propertyKey of keys) {
      expect(titles(core, { filter: { tagKey, propertyKey, op: "eq", value: 2 } })).toEqual([
        "first",
      ]);
      expect(titles(core, { sort: [{ tagKey, propertyKey, direction: "asc" }] })).toEqual([
        "second",
        "first",
      ]);
    }
    expect(
      titles(core, { filter: { tagKey, propertyKey: "constructor", op: "eq", value: null } }),
    ).toEqual(["second"]);
    expect(before.items[0]!.attachments[0]!.properties).toEqual(input);
    expect(Object.hasOwn(before.items[0]!.attachments[0]!.properties, "__proto__")).toBe(true);
    core
      .updateTagProperties(first.id, tagKey, Object.fromEntries(keys.map((key) => [key, null])))
      ._unsafeUnwrap();
    expect(core.getTagAttachment(first.id, tagKey)._unsafeUnwrap().properties).toEqual({});
    expect(
      titles(core, { filter: { tagKey, propertyKey: "__proto__", op: "eq", value: null } }),
    ).toEqual(["first", "second"]);
    expect(before.items[0]!.attachments[0]!.properties).toEqual(input);
    core.updateTagProperties(first.id, tagKey, { ["__proto__"]: 4 })._unsafeUnwrap();
    expect(
      titles(core, { filter: { tagKey, propertyKey: "__proto__", op: "eq", value: 4 } }),
    ).toEqual(["first"]);
  });

  it("uses null to unset values, retaining definitions and old snapshots", () => {
    const core = taskCore();
    const unset = core.createObject("unset");
    const set = core.createObject("set");
    expect(
      core.attachTag(unset.id, "task", { priority: null, memo: "" })._unsafeUnwrap().properties,
    ).toEqual({ memo: "" });
    core.attachTag(set.id, "task", { priority: 0, memo: "before" })._unsafeUnwrap();
    const before = core.query()._unsafeUnwrap();
    const input = { priority: null, memo: "after" };
    expect(core.updateTagProperties(set.id, "task", input)._unsafeUnwrap().properties).toEqual({
      memo: "after",
    });
    input.memo = "mutated";
    expect(
      core.updateTagProperties(set.id, "task", { priority: null })._unsafeUnwrap().properties,
    ).toEqual({ memo: "after" });
    expect(before.items[1]!.attachments[0]!.properties).toEqual({ priority: 0, memo: "before" });
    expect(titles(core, { filter: priority("eq", null) })).toEqual(["unset", "set"]);
    core.updateTagProperties(set.id, "task", { priority: 4 })._unsafeUnwrap();
    expect(titles(core, { filter: priority("eq", null) })).toEqual(["unset"]);
    expect(core.getTagAttachment(set.id, "task")._unsafeUnwrap().properties).toEqual({
      priority: 4,
      memo: "after",
    });
    expect(core.ensureTagProperty("task", "priority", "number").isOk()).toBe(true);
  });

  it("validates all writes before unsetting, with no partial changes on unknown/null/undefined inputs", () => {
    const core = taskCore();
    const object = core.createObject("atomic");
    core.attachTag(object.id, "task", { priority: 3, memo: "before" })._unsafeUnwrap();
    const before = core.getTagAttachment(object.id, "task")._unsafeUnwrap();
    for (const invalid of [
      { priority: null, memo: 42 },
      { priority: null, unknown: null },
      { priority: null, memo: undefined },
    ]) {
      expect(
        core
          .updateTagProperties(
            object.id,
            "task",
            invalid as unknown as Parameters<Core["updateTagProperties"]>[2],
          )
          .isErr(),
      ).toBe(true);
      expect(core.getTagAttachment(object.id, "task")._unsafeUnwrap()).toBe(before);
    }
    const unattached = core.createObject("failed attach");
    expect(core.attachTag(unattached.id, "task", { priority: null, unknown: null }).isErr()).toBe(
      true,
    );
    expect(core.getTagAttachment(unattached.id, "task").isErr()).toBe(true);
  });
});

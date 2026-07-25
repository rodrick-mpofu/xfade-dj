import { describe, expect, it } from "vitest";
import { moveItem, removeAt } from "./reorder";

describe("moveItem", () => {
  it("moves an item later", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an item earlier", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("swaps neighbours, which is what the up/down buttons do", () => {
    expect(moveItem(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 0, 2);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("returns the same reference when nothing changes, so no write is issued", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 0)).toBe(items);
    expect(moveItem(items, 0, 3)).toBe(items);
    expect(moveItem(items, 5, 0)).toBe(items);
  });

  it("preserves duplicates, since a track may repeat in a set", () => {
    expect(moveItem(["a", "b", "a"], 2, 0)).toEqual(["a", "a", "b"]);
  });

  it("handles a single-item list", () => {
    const items = ["a"];
    expect(moveItem(items, 0, 0)).toBe(items);
  });
});

describe("removeAt", () => {
  it("removes the item at an index", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("removes only the chosen occurrence of a repeated track", () => {
    expect(removeAt(["a", "b", "a"], 0)).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const items = ["a", "b"];
    removeAt(items, 0);
    expect(items).toEqual(["a", "b"]);
  });

  it("returns the same reference for an out-of-range index", () => {
    const items = ["a", "b"];
    expect(removeAt(items, -1)).toBe(items);
    expect(removeAt(items, 2)).toBe(items);
  });

  it("can empty a list", () => {
    expect(removeAt(["a"], 0)).toEqual([]);
  });
});

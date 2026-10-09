import { describe, expect, it } from "vitest";
import { compareSmart, isOverdue, type Rankable } from "../src/domain/sort.js";

const now = new Date("2026-01-10T12:00:00Z");
const h = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const mk = (id: string, o: Partial<Rankable> = {}): Rankable => ({
  id,
  priority: "medium",
  startAt: now,
  deadline: null,
  completed: false,
  createdAt: now,
  ...o,
});
const order = (xs: Rankable[]) => [...xs].sort(compareSmart(now)).map((x) => x.id);

// Risk: the order mixes completion, overdue, priority, deadline and start; each precedence rule and
// each tie-break must hold regardless of input order. Table-driven; every case also runs reversed.
const cases: [string, Rankable[], string[]][] = [
  ["completed always last, even if high priority and overdue", [mk("done", { completed: true, priority: "high", deadline: h(-5) }), mk("low-future", { priority: "low", deadline: h(500) })], ["low-future", "done"]],
  ["overdue before any non-overdue, even low vs high", [mk("high-soon", { priority: "high", deadline: h(1) }), mk("low-overdue", { priority: "low", deadline: h(-1) })], ["low-overdue", "high-soon"]],
  ["among overdue: higher priority first", [mk("low-older", { priority: "low", deadline: h(-100) }), mk("high-newer", { priority: "high", deadline: h(-1) })], ["high-newer", "low-older"]],
  ["among overdue with equal priority: more overdue first", [mk("b", { deadline: h(-1) }), mk("a", { deadline: h(-10) })], ["a", "b"]],
  ["same priority: nearer deadline first", [mk("far", { deadline: h(100) }), mk("near", { deadline: h(2) })], ["near", "far"]],
  ["priority lead: high due +30h (effective +6h) outranks low due +10h (effective +10h)", [mk("low", { priority: "low", deadline: h(10) }), mk("high", { priority: "high", deadline: h(30) })], ["high", "low"]],
  ["priority lead does not leapfrog a much earlier deadline", [mk("high-late", { priority: "high", deadline: h(100) }), mk("low-early", { priority: "low", deadline: h(5) })], ["low-early", "high-late"]],
  ["missing deadline sorts by start + 7d, so a due-in-5d task beats it", [mk("nodl", { priority: "low" }), mk("due5d", { priority: "low", deadline: h(120) })], ["due5d", "nodl"]],
  ["missing deadline high priority (effective +6d) vs low due in 7d: high first", [mk("low7d", { priority: "low", deadline: h(168) }), mk("nodl-high", { priority: "high" })], ["nodl-high", "low7d"]],
  ["deadline exactly now is NOT overdue", [mk("low-now", { priority: "low", deadline: now }), mk("high-future", { priority: "high", deadline: h(40) })], ["low-now", "high-future"]],
  ["equal effective time: higher priority wins (low +24h == high +48h)", [mk("low", { priority: "low", deadline: h(24) }), mk("high", { priority: "high", deadline: h(48) })], ["high", "low"]],
  ["identical everything except startAt: earlier start first", [mk("late", { startAt: h(2) }), mk("early", { startAt: h(1) })], ["early", "late"]],
  ["identical except createdAt: earlier created first", [mk("new", { createdAt: h(5) }), mk("old", { createdAt: h(-5) })], ["old", "new"]],
  ["fully identical: id decides (deterministic)", [mk("b"), mk("a"), mk("c")], ["a", "b", "c"]],
];

describe("smart sort", () => {
  it.each(cases)("%s", (_name, input, expected) => {
    expect(order(input)).toEqual(expected);
    expect(order([...input].reverse())).toEqual(expected);
  });

  it("is a consistent total order (antisymmetric and transitive) over a mixed set", () => {
    const set = [
      mk("a", { priority: "high", deadline: h(-3) }),
      mk("b", { priority: "low", deadline: h(-3) }),
      mk("c", { priority: "high", deadline: h(10) }),
      mk("d", { priority: "medium" }),
      mk("e", { completed: true }),
      mk("f", { priority: "low", deadline: h(10) }),
    ];
    const cmp = compareSmart(now);
    for (const x of set) for (const y of set) expect(Math.sign(cmp(x, y)) + 0).toBe(-Math.sign(cmp(y, x)) + 0);
    const sorted = [...set].sort(cmp);
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) expect(cmp(sorted[i]!, sorted[j]!)).toBeLessThanOrEqual(0);
  });

  it("isOverdue: needs a past deadline and not completed", () => {
    expect(isOverdue(mk("x", { deadline: h(-1) }), now)).toBe(true);
    expect(isOverdue(mk("x", { deadline: h(-1), completed: true }), now)).toBe(false);
    expect(isOverdue(mk("x", { deadline: null }), now)).toBe(false);
    expect(isOverdue(mk("x", { deadline: now }), now)).toBe(false);
  });
});

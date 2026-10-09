import { describe, expect, it } from "vitest";
import { compareSmart, smartScore, type Rankable } from "../src/domain/sort.js";

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

// Distinct risk: the ranking mixes three inputs; each rule and the tie-break chain must be deterministic.
describe("smart sort", () => {
  it("overdue beats everything else incomplete; completed always last", () => {
    const out = order([
      mk("done-urgent", { completed: true, priority: "high", deadline: h(-5) }),
      mk("future-high", { priority: "high", deadline: h(240) }),
      mk("overdue-low", { priority: "low", deadline: h(-1) }),
    ]);
    expect(out).toEqual(["overdue-low", "future-high", "done-urgent"]);
  });

  it("nearer deadline outranks same-priority farther deadline", () => {
    expect(order([mk("far", { deadline: h(100) }), mk("near", { deadline: h(2) })])).toEqual(["near", "far"]);
  });

  it("a due-soon low task can outrank a no-deadline high task", () => {
    expect(smartScore(mk("a", { priority: "low", deadline: h(1) }), now)).toBeGreaterThan(
      smartScore(mk("b", { priority: "high" }), now),
    );
  });

  it("exact ties resolve by deadline, startAt, createdAt, then id (stable regardless of input order)", () => {
    const a = mk("a");
    const b = mk("b");
    const c = mk("c", { startAt: h(-1) });
    expect(order([b, a, c])).toEqual(["c", "a", "b"]);
    expect(order([a, b, c])).toEqual(["c", "a", "b"]);
  });

  it("deadline exactly now is not overdue-boosted but scores the maximum on-time value", () => {
    expect(smartScore(mk("x", { deadline: now }), now)).toBe(20 + 70);
  });
});

import { describe, expect, it } from "vitest";
import { getCurrentDateLabel, getLocalDayKey, getMillisecondsUntilNextLocalDay } from "./useCurrentDateLabel";

describe("current date label", () => {
  it("formats one shared date without time", () => {
    const date = new Date(2026, 8, 3, 14, 25, 10);

    expect(getCurrentDateLabel(date)).toBe("03/09/2026");
    expect(getCurrentDateLabel(new Date(2026, 8, 3, 23, 59, 59))).toBe("03/09/2026");
  });

  it("changes its day key exactly across local midnight", () => {
    const beforeMidnight = new Date(2026, 8, 3, 23, 59, 59);
    const afterMidnight = new Date(2026, 8, 4, 0, 0, 1);

    expect(getLocalDayKey(beforeMidnight)).toBe("2026-09-03");
    expect(getLocalDayKey(afterMidnight)).toBe("2026-09-04");
  });

  it("schedules the next refresh at the next local midnight", () => {
    const date = new Date(2026, 8, 3, 23, 30, 0);
    const delay = getMillisecondsUntilNextLocalDay(date);

    expect(delay).toBe(30 * 60 * 1000 + 50);
  });
});

import { describe, expect, it } from "vitest";
import { getAdminAccessState } from "./adminAccess";

describe("admin access guard", () => {
  it("keeps the panel in a loading state while auth is unresolved", () => {
    expect(getAdminAccessState(undefined, true)).toBe("loading");
  });

  it("requires login when there is no authenticated user", () => {
    expect(getAdminAccessState(null, false)).toBe("login");
  });

  it("denies the panel to authenticated non-admin users", () => {
    expect(getAdminAccessState({ role: "user" }, false)).toBe("denied");
  });

  it("grants the panel only to admins", () => {
    expect(getAdminAccessState({ role: "admin" }, false)).toBe("granted");
  });
});

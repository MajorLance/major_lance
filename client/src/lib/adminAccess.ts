export type AdminAccessUser = {
  role: "admin" | "user";
};

export type AdminAccessState = "loading" | "login" | "denied" | "granted";

export function getAdminAccessState(
  user: AdminAccessUser | null | undefined,
  authLoading: boolean,
): AdminAccessState {
  if (authLoading) return "loading";
  if (!user) return "login";
  return user.role === "admin" ? "granted" : "denied";
}

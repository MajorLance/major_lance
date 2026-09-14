export type PixClipboard = { writeText: (text: string) => Promise<void> };

export async function copyPixCode(code: string, clipboard?: PixClipboard) {
  const target = clipboard ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined);
  if (!target) return false;
  await target.writeText(code);
  return true;
}

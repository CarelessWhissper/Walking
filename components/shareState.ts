import type { ShareCardData } from "./ShareCard";

let pending: ShareCardData | null = null;

export function setPendingShare(data: ShareCardData) {
  pending = data;
}

export function readPendingShare(): ShareCardData | null {
  return pending;
}

export function clearPendingShare() {
  pending = null;
}

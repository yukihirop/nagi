let warned = false;

export function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    if (!warned) {
      warned = true;
      console.warn("localStorage is not available");
    }
  }
  return null;
}

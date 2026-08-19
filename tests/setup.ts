// Vitest v4's worker_threads pool uses a file-based localStorage bridge that
// does not implement the full Web Storage API (missing clear(), key(), etc.).
// This setup file replaces it with a complete in-memory implementation so that
// unit tests that call localStorage.clear() / localStorage.setItem() work correctly.

let _store: Record<string, string> = {};

const localStorageMock = {
  getItem(key: string): string | null {
    return Object.hasOwn(_store, key) ? _store[key] : null;
  },
  setItem(key: string, value: string): void {
    _store[key] = String(value);
  },
  removeItem(key: string): void {
    delete _store[key];
  },
  clear(): void {
    _store = {};
  },
  get length(): number {
    return Object.keys(_store).length;
  },
  key(index: number): string | null {
    return Object.keys(_store)[index] ?? null;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

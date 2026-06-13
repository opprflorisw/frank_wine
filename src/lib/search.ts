// Global, decoupled trigger for the command-palette search (Cmd/Ctrl+K or nav button).
export const OPEN_SEARCH_EVENT = "fw:open-search";
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

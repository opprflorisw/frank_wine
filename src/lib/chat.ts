// Global, decoupled way to open the in-app sommelier chat from anywhere
// (nav, map region panel, buttons) without routing to a separate page.
export const OPEN_CHAT_EVENT = "fw:open-chat";

/** Open the floating sommelier chat. Optionally pre-fill (and send) a prompt. */
export function openChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { prompt } }));
}

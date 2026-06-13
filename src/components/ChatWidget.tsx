import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";
import { OPEN_CHAT_EVENT } from "../lib/chat";
import Markdown from "./Markdown";

function threadId(): string {
  let id = localStorage.getItem("fw_thread");
  if (!id) {
    id = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
    localStorage.setItem("fw_thread", id);
  }
  return id;
}

const SUGGESTIONS = [
  "What makes Burgundy's terroir so special?",
  "Recommend a 2-day wine trip in Champagne",
  "Which houses should I visit in Bordeaux?",
  "Compare Northern and Southern Rhône",
  "Best regions for Pinot Noir lovers?",
];

export default function ChatWidget() {
  const [tid] = useState(threadId);
  const messages = useQuery(api.messages.listByThread, { threadId: tid }) ?? [];
  const ask = useAction(api.agent.chat);
  const clear = useMutation(api.messages.clear);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const last = messages[messages.length - 1];
  const lastStreaming = !!last && last.role === "assistant" && last.done !== true;
  // A pending typing indicator is needed when we've sent (or the assistant is
  // working) but no assistant message exists yet to host the live content.
  const pending = (sending || lastStreaming) && (!last || last.role === "user");
  const lastLen = last?.content?.length ?? 0;

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setInput("");
    setSending(true);
    try {
      await ask({ threadId: tid, message: q });
    } catch {
      /* swallow — the reactive query reflects state; avoid crashing the widget */
    } finally {
      setSending(false);
    }
  }

  // Keep a live ref to send so the global event listener never goes stale.
  const sendRef = useRef(send);
  sendRef.current = send;

  // Open / auto-send from anywhere via openChat().
  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      const prompt = (e as CustomEvent).detail?.prompt;
      if (prompt && typeof prompt === "string") {
        // Defer so the panel mounts before we kick off the request.
        setTimeout(() => sendRef.current(prompt), 0);
      }
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  // Auto-scroll on new messages or streamed content growth.
  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastLen, pending, open]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  if (!open) {
    return (
      <button
        className="cw-fab"
        aria-label="Ask Franky"
        onClick={() => setOpen(true)}
      >
        <span className="cw-fab-glass" aria-hidden>🍷</span>
        <Icon name="chat" size={20} sw={1.5} />
      </button>
    );
  }

  return (
    <div className="cw-panel" role="dialog" aria-label="Ask Franky">
      <header className="cw-head">
        <div className="cw-head-text">
          <div className="cw-title">
            <span aria-hidden>🍷</span> Franky
          </div>
          <div className="cw-sub">Frank's wine guide</div>
        </div>
        <div className="cw-head-actions">
          {messages.length > 0 && (
            <button
              className="cw-new"
              aria-label="Clear conversation"
              title="Clear conversation"
              onClick={() => clear({ threadId: tid })}
            >
              <span aria-hidden>⟲</span> New chat
            </button>
          )}
          <button className="cw-x" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
      </header>

      <div className="cw-log">
        {messages.length === 0 && !pending && (
          <div className="cw-empty">
            <p>Hi, I'm Franky — ask me about French wine: regions, houses, grapes or planning a trip.</p>
            <div className="cw-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => {
          const isLast = idx === messages.length - 1;
          const streamingThis = isLast && m.role === "assistant" && m.done !== true;
          const empty = !m.content || !m.content.trim();
          if (streamingThis && empty) {
            return (
              <div key={m._id} className="cw-msg assistant">
                <div className="cw-avatar">🍷</div>
                <div className="cw-bubble cw-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            );
          }
          return (
            <div key={m._id} className={`cw-msg ${m.role}`}>
              <div className="cw-avatar">{m.role === "assistant" ? "🍷" : "🙂"}</div>
              <div className="cw-bubble">
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                {streamingThis && !empty && <span className="cw-caret" />}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="cw-msg assistant">
            <div className="cw-avatar">🍷</div>
            <div className="cw-bubble cw-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="cw-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Franky about French wine…"
        />
        <button type="submit" className="cw-send" disabled={sending || !input.trim()} aria-label="Send">
          <Icon name="send" size={16} />
        </button>
      </form>

      {messages.length > 0 && (
        <button className="cw-clear" onClick={() => clear({ threadId: tid })}>
          Clear conversation
        </button>
      )}
    </div>
  );
}

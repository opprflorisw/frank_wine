import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";
import Markdown from "../components/Markdown";

function threadId(): string {
  let id = localStorage.getItem("fw_thread");
  if (!id) { id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)); localStorage.setItem("fw_thread", id); }
  return id;
}

const SUGGESTIONS = [
  "What makes Burgundy's terroir so special?",
  "Recommend a 2-day wine trip in Champagne",
  "Which houses should I visit in Bordeaux?",
  "Compare Northern and Southern Rhône",
  "Best regions for Pinot Noir lovers?",
];

export default function AskPage() {
  const [tid] = useState(threadId);
  const messages = useQuery(api.messages.listByThread, { threadId: tid }) ?? [];
  const ask = useAction(api.agent.chat);
  const clear = useMutation(api.messages.clear);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const last = messages[messages.length - 1];
  const lastStreaming = !!last && last.role === "assistant" && last.done !== true;
  const pending = (sending || lastStreaming) && (!last || last.role === "user");
  const lastLen = last?.content?.length ?? 0;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, lastLen, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setInput("");
    setSending(true);
    try { await ask({ threadId: tid, message: q }); }
    finally { setSending(false); }
  }

  return (
    <div className="page ask-page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Ask the Sommelier</h1>
        <p className="lede">A wine-savvy AI guide with the whole almanac at its fingertips — ask about regions, houses, grapes, terroir or planning a tasting trip.</p>
      </div>

      <div className="chat">
        <div className="chat-log">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="big"><Icon name="chat" size={40} sw={1.3} /></div>
              <p>Start a conversation, or try one of these:</p>
              <div className="suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
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
                <div key={m._id} className="msg assistant">
                  <div className="avatar">🍷</div>
                  <div className="bubble typing"><span></span><span></span><span></span></div>
                </div>
              );
            }
            return (
              <div key={m._id} className={`msg ${m.role}`}>
                <div className="avatar">{m.role === "assistant" ? "🍷" : "🙂"}</div>
                <div className="bubble">
                  {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                  {streamingThis && !empty && <span className="caret" />}
                </div>
              </div>
            );
          })}
          {pending && (
            <div className="msg assistant">
              <div className="avatar">🍷</div>
              <div className="bubble typing"><span></span><span></span><span></span></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about French wine…" autoFocus />
          <button type="submit" className="btn primary" disabled={sending || !input.trim()}><Icon name="send" size={16} /></button>
        </form>
        {messages.length > 0 && (
          <button className="chat-clear" onClick={() => clear({ threadId: tid })}>Clear conversation</button>
        )}
      </div>
    </div>
  );
}

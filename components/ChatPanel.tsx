"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/context";
import type { ChatMessage } from "@/types";

export default function ChatPanel() {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = streamingText !== null;
  const committed = state.conversationHistory;

  // Scroll to bottom whenever messages or streaming text changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [committed, streamingText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Commit user message
    dispatch({ type: "ADD_USER_MESSAGE", content: trimmed });

    // Stream AI response into local state — only commit once complete
    setStreamingText("");

    // Prefer sessionId-only (context stays server-side).
    // Fall back to sending fullContext inline when the session wasn't persisted yet.
    const body = state.sessionId
      ? { sessionId: state.sessionId, message: trimmed }
      : {
          message: trimmed,
          fullContext: {
            ...(state.masterContext ?? {}),
            instrumentAnalyses:  state.instrumentAnalyses,
            teachingSummary:     state.teachingSummary,
            conversationHistory: state.conversationHistory,
          },
        };

    let accumulated = "";
    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        // Try to get a meaningful error from the response
        const errData = await res.json().catch(() => ({}));
        const isGeminiBusy = errData.code === "GEMINI_BUSY" || res.status === 503;
        throw new Error(
          isGeminiBusy
            ? "The AI is experiencing high demand right now. Please try again in a moment."
            : `Chat error ${res.status}: ${errData.error ?? res.statusText}`
        );
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingText(accumulated);
      }
    } catch (err) {
      console.error("[ChatPanel] error", err);
      accumulated = err instanceof Error
        ? err.message
        : "Sorry, something went wrong. Please try again.";
      setStreamingText(accumulated);
    }

    // Commit the finished response and clear stream
    dispatch({ type: "ADD_ASSISTANT_MESSAGE", content: accumulated });
    setStreamingText(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Greeting shown when no committed messages yet
  const greeting: ChatMessage = {
    role: "assistant",
    content:
      "Hello! I'm MaestroAI, your personal music teacher. I've fully analysed your sheet and I'm ready to help. Ask me about fingering, phrasing, technique — or anything you're finding tricky.",
  };
  const displayMessages: ChatMessage[] =
    committed.length === 0 ? [greeting] : committed;

  return (
    <aside className="hidden lg:flex flex-col w-[40%] h-full bg-[#111111]">
      {/* Header */}
      <header className="p-6 border-b border-surface-container-low shrink-0 bg-[#111111]/80 backdrop-blur-sm z-10">
        <h2 className="font-playfair font-semibold text-headline-lg text-on-surface">
          Ask your teacher
        </h2>
        <p className="font-inter text-body-md text-on-surface-variant mt-1">
          Maestro is ready to answer questions about this piece.
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col">
        {displayMessages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {/* Streaming bubble — live text */}
        {isStreaming && (
          streamingText
            ? <ChatBubble role="assistant" content={streamingText} streaming />
            : <TypingIndicator />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-[#111111] border-t border-surface-container-low shrink-0 pb-8">
        <div className="relative flex items-end bg-surface-container rounded-xl border border-surface-container-highest focus-within:border-primary-container/60 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this sheet…"
            rows={1}
            disabled={isStreaming}
            className="w-full bg-transparent border-none text-on-surface font-inter text-body-md placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none resize-none py-4 pl-4 pr-14 max-h-32 min-h-[56px] disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={`absolute right-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center transition-all
              ${input.trim() && !isStreaming
                ? "bg-primary-container text-[#0a0a0a] hover:brightness-110 shadow-[0_0_10px_rgba(245,158,11,0.2)] active:scale-95"
                : "bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-50"
              }`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          </button>
        </div>
        <p className="text-center font-inter text-label-sm text-on-surface-variant/40 mt-3">
          MaestroAI may produce inaccurate musical information.
        </p>
      </div>
    </aside>
  );
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────

function ChatBubble({
  role,
  content,
  streaming = false,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="bg-primary-container px-4 py-3 rounded-l-xl rounded-tr-xl max-w-[85%] shadow-[0_0_12px_rgba(245,158,11,0.12)]">
          <p className="font-inter text-body-md text-[#0a0a0a]">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fadeIn">
      <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-primary-container/20 mt-1">
        <span
          className="material-symbols-outlined text-primary text-base"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          music_note
        </span>
      </div>
      <div className="bg-surface-container-low border-l-2 border-primary-container px-4 py-3 rounded-r-xl rounded-bl-xl max-w-[85%]">
        <p className="font-inter text-body-md text-on-surface whitespace-pre-wrap">
          {content}
          {streaming && (
            <span className="inline-block w-0.5 h-4 bg-primary-container ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fadeIn">
      <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-primary-container/20">
        <span
          className="material-symbols-outlined text-primary text-base"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          music_note
        </span>
      </div>
      <div className="bg-surface-container-low border-l-2 border-primary-container px-4 py-4 rounded-r-xl rounded-bl-xl">
        <div className="flex gap-1.5 items-center">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-primary-container animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chatWithTutor } from "../app/actions/tutor";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type TutorChatProps = {
  sessionId: string;
  courseId: string;
  starterPrompts?: string[];
  initialMessage?: string;
};

export default function TutorChat({
  sessionId,
  courseId,
  starterPrompts = [],
  initialMessage,
}: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);
  const promptOptions = starterPrompts.length
    ? starterPrompts
    : ["Quiz me on a random topic", "I'm panicking! Help!", "Explain this concept simply"];
  const showStarterPrompts =
    messages.length === 0 ||
    (messages.length === 1 && messages[0]?.role === "assistant");

  useEffect(() => {
    if (!initialMessage) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: initialMessage,
        },
      ];
    });
  }, [initialMessage]);

  async function handleSend() {
    if (!canSend) return;

    const userText = input.trim();
    setInput("");
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatWithTutor(sessionId, userText, courseId);
      if (!response.ok) {
        throw new Error(response.error);
      }
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (error) {
      const fallbackMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Something went wrong while contacting the preceptor. Please try again.",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/40">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-cyan-500/80 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {message.role === "assistant" ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {showStarterPrompts ? (
          <div className="relative z-10 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
            Start by asking a clinical question or clarifying a concept.
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {promptOptions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500 hover:text-cyan-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-300">
              Preceptor is thinking...
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-4">
        <div className="flex items-center gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.ctrlKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Ask the preceptor anything..."
            className="flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import FileDrop from "./FileDrop";
import ResultPanel from "./ResultPanel";
import type { ResultPanelData } from "@/types/resultPanel";
import type { AssistantAction } from "@/lib/assistant/types";

const EXAMPLE_LINES = [
  "Ready. Example commands:",
  '• "Lunch with Jasper tomorrow at 7pm" → calendar event',
  '• "Email Jasper his to-do list" → Gmail draft & send',
  '• "Business: build new boat cleaning PWA" → categorized tasks',
];

type UploadedFile = {
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
};

type AssistantResponse = {
  error?: string;
  logLines?: string[];
  actions?: AssistantAction[];
};

type Props = {
  whisperEnabled?: boolean;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function CommandConsole({ whisperEnabled = false }: Props) {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micTranscript, setMicTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [resultPanel, setResultPanel] = useState<ResultPanelData | null>(null);
  const [cleaningTranscript, setCleaningTranscript] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldContinueRef = useRef(false);
  const rawTranscriptRef = useRef("");
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  function appendLog(entries: string | string[], prefix = "") {
    const lines = Array.isArray(entries) ? entries : [entries];
    setLogLines((prev) => {
      const mapped = lines.map((line) => (prefix ? `${prefix}${line}` : line));
      const next = [...prev, ...mapped];
      return next.length > 150 ? next.slice(next.length - 150) : next;
    });
  }

  async function runCommand(forcedInput?: string) {
    const rawText = forcedInput ?? input;
    const commandText = rawText.trim();
    if (!commandText) {
      return;
    }
    appendLog(`> ${commandText}`);
    setRunning(true);
    if (!forcedInput) {
      setInput("");
    } else {
      setInput("");
    }

    try {
      const timezone =
        typeof window !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "America/New_York";
      const res = await fetch("/api/assistant/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: commandText,
          micTranscript,
          timezone,
        }),
      });
      let data: AssistantResponse = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      console.log("[CommandConsole] API response:", data);
      const responseLines = Array.isArray(data.logLines) ? data.logLines : [];
      if (!res.ok) {
        if (responseLines.length) {
          appendLog(responseLines);
        } else {
          appendLog(`[assistant] [error] Assistant failed: HTTP ${res.status}`);
        }
        return;
      }
      if (responseLines.length) {
        appendLog(responseLines);
      } else {
        appendLog("[assistant] Done.");
      }
      const actions = Array.isArray(data.actions) ? data.actions : [];
      handleActions(actions);
      setAttachments([]);
      setMicTranscript("");
    } catch (err: any) {
      appendLog(`[assistant] [error] ${err?.message ?? "Command failed"}`);
    } finally {
      setRunning(false);
    }
  }

  function handleActions(actions: AssistantAction[]) {
    if (!Array.isArray(actions) || actions.length === 0) {
      setResultPanel(null);
      return;
    }
    if (
      actions.some((action) =>
        ["create_tasks", "update_task", "delete_task"].includes(action.type)
      )
    ) {
      mutate("/api/tasks");
    }
    if (
      actions.some((action) =>
        ["create_events", "delete_event"].includes(action.type)
      )
    ) {
      mutate("/api/calendar/list");
    }
    const displayAction = actions.find((action) => action.type === "display");
    if (displayAction?.type === "display") {
      setResultPanel(convertDisplayToPanel(displayAction));
    } else {
      setResultPanel(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!running) {
        runCommand();
      }
    }
  }

  async function handleFilesSelected(files: File[]) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    setFileUploading(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      const saved: UploadedFile[] = Array.isArray(data.files) ? data.files : [];
      appendLog(`[files] Attached ${saved.length} file(s).`);
      setAttachments((prev) => [...prev, ...saved]);
    } catch (err: any) {
      appendLog(`[files] ${err?.message ?? "Upload failed"}`);
    } finally {
      setFileUploading(false);
    }
  }

  function removeAttachment(path: string) {
    setAttachments((prev) => prev.filter((file) => file.path !== path));
  }

  function startListening() {
    if (isListening || !speechSupported || typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      appendLog("[mic] Voice input not supported in this browser.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onstart = () => {
        setIsListening(true);
        rawTranscriptRef.current = "";
        setMicTranscript("");
      };
      recognition.onerror = (event: any) => {
        appendLog(`[mic] ${event.error || "Recognition error"}`);
      };
      recognition.onresult = (event: any) => {
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript + " ";
          }
        }
        if (finalChunk) {
          rawTranscriptRef.current = `${rawTranscriptRef.current} ${finalChunk}`.trim();
          setMicTranscript(rawTranscriptRef.current);
        }
      };
      recognition.onend = () => {
        if (shouldContinueRef.current) {
          recognition.start();
        } else {
          setIsListening(false);
          recognitionRef.current = null;
          finalizeTranscript();
        }
      };
      recognitionRef.current = recognition;
      shouldContinueRef.current = true;
      recognition.start();
    } catch (err: any) {
      appendLog(`[mic] ${err?.message ?? "Could not start microphone"}`);
      stopListening();
    }
  }

  function stopListening() {
    shouldContinueRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }

  async function finalizeTranscript() {
    const raw = rawTranscriptRef.current.trim();
    rawTranscriptRef.current = "";
    setMicTranscript("");
    if (!raw) return;
    setCleaningTranscript(true);
    try {
      const res = await fetch("/api/assistant/clean-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to clean transcription");
      }
      const cleaned = data.text || raw;
      setInput((prev) => `${prev} ${cleaned}`.trim());
      appendLog(`[mic] ${cleaned}`);
    } catch (err: any) {
      appendLog(`[mic] ${err?.message ?? "Transcript cleanup failed"}`);
    } finally {
      setCleaningTranscript(false);
    }
  }

  function triggerAudioUpload() {
    if (!whisperEnabled) {
      appendLog("[audio] Enable Whisper to upload audio.");
      return;
    }
    audioInputRef.current?.click();
  }

  async function handleAudioFile(file: File) {
    setAudioUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/assistant/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Transcription failed");
      }
      const text = data.text?.trim();
      if (text) {
        appendLog(`[audio] ${text}`);
        await runCommand(text);
      }
    } catch (err: any) {
      appendLog(`[audio] ${err?.message ?? "Transcription failed"}`);
    } finally {
      setAudioUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card flex h-full flex-col p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="card-title text-base">Command Console</div>
            <p className="text-xs text-slate-400">
              Text, voice, files → OpenAI actions
            </p>
          </div>
          <span className="text-xs text-slate-400">Ctrl/⌘ + Enter to run</span>
        </header>
        <div className="mt-4 space-y-4">
          <FileDrop onFilesSelected={handleFilesSelected} />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {attachments.map((file) => (
                <span
                  key={file.path}
                  className="flex items-center gap-2 rounded-full bg-[#f5f7ff] px-3 py-1 text-[#1b2b5c]"
                >
                  {file.name}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => removeAttachment(file.path)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {isListening && (
            <div className="rounded-2xl border border-[#406cff] bg-[#f5f7ff] px-4 py-2 text-sm text-[#1b2b5c]">
              Listening… {micTranscript || "Speak now."}
            </div>
          )}
          {cleaningTranscript && (
            <div className="text-xs text-slate-500">Cleaning transcript…</div>
          )}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want your assistant to do..."
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-[#406cff] focus:outline-none"
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => runCommand()}
              disabled={running}
              className="rounded-full bg-[#406cff] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2d4eea] disabled:opacity-60"
            >
              {running ? "Executing…" : "Run command"}
            </button>
            <button
              type="button"
              onClick={startListening}
              disabled={!speechSupported || isListening}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#406cff] hover:text-[#406cff] disabled:opacity-40"
            >
              {isListening ? "Listening…" : "Start mic"}
            </button>
            <button
              type="button"
              onClick={stopListening}
              disabled={!isListening}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:border-red-400 disabled:opacity-40"
            >
              Stop listening
            </button>
            <button
              type="button"
              onClick={triggerAudioUpload}
              disabled={audioUploading || !whisperEnabled}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#406cff] hover:text-[#406cff] disabled:opacity-40"
            >
              {audioUploading ? "Uploading…" : "Upload audio"}
            </button>
            <span className="text-xs text-slate-400">
              {fileUploading
                ? "Uploading files…"
                : running
                  ? "Assistant is working…"
                  : "Output appears in the log below."}
            </span>
          </div>
          <input
            type="file"
            accept=".mp3,.wav,.m4a,audio/*"
            className="hidden"
            ref={audioInputRef}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                handleAudioFile(file);
              }
            }}
          />
        </div>
        <div
          ref={logRef}
          className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
        >
          <pre className="whitespace-pre-wrap text-xs font-mono text-slate-700">
            {logLines.join("\n")}
          </pre>
          <div className="mt-2 text-[11px] text-slate-500">
            {EXAMPLE_LINES.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </section>
      {resultPanel && <ResultPanel data={resultPanel} />}
    </div>
  );
}

function convertDisplayToPanel(action: AssistantAction & { type: "display" }): ResultPanelData {
  const rangeLabel =
    action.range?.startIso || action.range?.endIso
      ? `${action.range?.startIso ?? "..."} → ${action.range?.endIso ?? "..."}`
      : "All";

  return {
    heading: `Display: ${action.mode}`,
    sections: [
      {
        title: "Details",
        items: [{ primary: `Mode: ${action.mode}`, secondary: `Range: ${rangeLabel}` }],
      },
    ],
  };
}

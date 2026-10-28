"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

const MAX_FILES = 500;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Status = "waiting" | "processing" | "done" | "failed";

type Item = {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  resultUrl?: string;
  status: Status;
  error?: string;
};

const checkerStyle: React.CSSProperties = {
  background: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px",
};

export default function BackgroundRemoverPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const cancelRef = useRef(false);
  const modelReadyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.originalUrl);
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
      });
    };
  }, []);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const valid = incoming.filter((f) => ALLOWED.includes(f.type));
    const skipped = incoming.length - valid.length;
    const room = MAX_FILES - itemsRef.current.length;
    const accepted = valid.slice(0, Math.max(0, room));
    const tooMany = valid.length - accepted.length;

    const msgs: string[] = [];
    if (skipped > 0) msgs.push(`${skipped} file(s) skipped (use JPG, PNG or WEBP).`);
    if (tooMany > 0) msgs.push(`${tooMany} file(s) skipped (limit is ${MAX_FILES} per session).`);
    setNotice(msgs.join(" "));

    const newItems: Item[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      originalUrl: URL.createObjectURL(file),
      status: "waiting",
    }));
    if (newItems.length) setItems((prev) => [...prev, ...newItems]);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function startRemoving() {
    if (running) return;
    const queue = itemsRef.current.filter(
      (i) => i.status === "waiting" || i.status === "failed"
    );
    if (queue.length === 0) return;

    cancelRef.current = false;
    setRunning(true);
    setNotice("");

    try {
      for (const item of queue) {
        if (cancelRef.current) break;
        updateItem(item.id, { status: "processing", error: undefined });
        if (!modelReadyRef.current) setModelLoading(true);

        try {
          const lib = await import("@imgly/background-removal");
          const blob: Blob = await lib.removeBackground(item.file, {
            output: { format: "image/png" },
          });
          modelReadyRef.current = true;
          setModelLoading(false);
          const resultUrl = URL.createObjectURL(blob);
          updateItem(item.id, { status: "done", resultUrl });
        } catch (err) {
          setModelLoading(false);
          const message = modelReadyRef.current
            ? "Could not process this image."
            : "Model download failed. Check your internet, VPN or ad-block, then try again.";
          updateItem(item.id, { status: "failed", error: message });
          if (!modelReadyRef.current) {
            setNotice(message);
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 30));
      }
    } finally {
      setRunning(false);
      setModelLoading(false);
    }
  }

  function download(item: Item) {
    if (!item.resultUrl) return;
    const a = document.createElement("a");
    a.href = item.resultUrl;
    a.download = item.name.replace(/\.[^/.]+$/, "") + "-no-bg.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function clearAll() {
    cancelRef.current = true;
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.originalUrl);
      if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
    });
    setItems([]);
    setNotice("");
    setRunning(false);
    setModelLoading(false);
  }

  const total = items.length;
  const finished = items.filter((i) => i.status === "done" || i.status === "failed").length;
  const percent = total ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Background Remover</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Remove image backgrounds free, right in your browser.
        </p>
      </div>

      <label
        className="dropzone-static flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 cursor-pointer"
        style={dragging ? { borderColor: "hsl(21 90% 44%)" } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="h-8 w-8 text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">
          Drag &amp; drop images, or <span className="underline underline-offset-4">browse</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          JPG, PNG, WEBP. Up to {MAX_FILES} images per session.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Your images stay on your computer. Nothing is uploaded.
        </p>
      </label>

      {notice && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      {total > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {finished} of {total} finished
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startRemoving}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                {running ? "Working..." : "Remove backgrounds"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {modelLoading && (
            <p className="text-xs text-muted-foreground">
              Downloading the AI model, this can take a minute.
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-card p-3 space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="overflow-hidden rounded-xl bg-muted aspect-square flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.originalUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div
                  className="overflow-hidden rounded-xl aspect-square flex items-center justify-center"
                  style={checkerStyle}
                >
                  {item.resultUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.resultUrl}
                      alt={`${item.name} without background`}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : item.status === "processing" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-foreground" title={item.name}>
                  {item.name}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  {item.status === "waiting" && (
                    <>
                      <Clock className="h-3.5 w-3.5" /> Waiting
                    </>
                  )}
                  {item.status === "processing" && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                    </>
                  )}
                  {item.status === "done" && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Done
                    </>
                  )}
                  {item.status === "failed" && (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Failed
                    </>
                  )}
                </span>
              </div>

              {item.error && <p className="text-[11px] text-red-600">{item.error}</p>}

              {item.status === "done" && (
                <button
                  type="button"
                  onClick={() => download(item)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
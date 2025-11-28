"use client";

import { useRef, useState } from "react";

type Props = {
  onFilesSelected(files: File[]): void;
};

export default function FileDrop({ onFilesSelected }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    setSelectedNames((prev) => [...prev, ...files.map((file) => file.name)]);
    onFilesSelected(files);
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed px-5 py-4 text-sm transition ${
        isDragging ? "border-[#406cff] bg-[#f5f7ff]" : "border-slate-200 bg-white/80"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="font-semibold text-[#1b2b5c]">Drop files here or click to upload</p>
      <p className="text-xs text-slate-500">Images, PDFs, screenshots are welcome.</p>
      {selectedNames.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {selectedNames.map((name, index) => (
            <li key={`${name}-${index}`} className="truncate">
              • {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

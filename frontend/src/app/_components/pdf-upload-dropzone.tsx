"use client";

import { memo, useId, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

type PdfUploadDropzoneProps = {
  dark: boolean;
  icon: ReactNode;
  file: File | null;
  helperText: string;
  onFileSelect: (file: File | null) => void;
};

export const PdfUploadDropzone = memo(function PdfUploadDropzone({
  dark,
  icon,
  file,
  helperText,
  onFileSelect,
}: PdfUploadDropzoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  // ADDED: centralize PDF-only upload handling for drag/drop and click selection.
  const commitFile = (nextFile: File | null) => {
    if (!nextFile) {
      onFileSelect(null);
      return;
    }

    const isPdf = nextFile.type === "application/pdf" || nextFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return;
    onFileSelect(nextFile);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    commitFile(event.target.files?.[0] || null);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    commitFile(event.dataTransfer.files?.[0] || null);
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative block rounded-[2.5rem] border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
        dark
          ? "border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5"
          : "border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50"
      } ${isDragging ? "border-[#CC208E] bg-[#CC208E]/5 scale-[1.01]" : ""}`}
    >
      <input id={inputId} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleInputChange} />

      <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center gap-4 py-4">
        <div className={`transition-transform duration-500 ${isDragging ? "scale-110" : "group-hover:scale-110"}`}>{icon}</div>
        <div className="space-y-2">
          <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
            {file ? file.name : "Drag & drop a PDF or click to upload"}
          </p>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">{helperText}</p>
        </div>
      </div>
    </label>
  );
});

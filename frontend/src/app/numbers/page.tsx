"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Hash, FileUp, CheckCircle, RefreshCcw, 
  Type, Palette, Layout, Download, UploadCloud 
} from "lucide-react";
import Link from "next/link";

const BRAND = { magenta: "#CC208E", bgDark: "#050412", bgSpotlight: "#100654" };

export default function PageNumbering() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [settings, setSettings] = useState({
    position: "bottom_right",
    fontSize: 12,
    color: "#CC208E",
    startIdx: 1,
    formatType: "standard" // "standard", "x_of_y", "roman"
  });

  const handleFile = (f: File) => {
    if (f.type === "application/pdf") {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      alert("Invalid Asset: Please inject a PDF shard.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleApplyNumbering = () => {
    if (!file) return;
    setLoading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", settings.position);
    formData.append("font_size", settings.fontSize.toString());
    formData.append("color", settings.color);
    formData.append("start_index", settings.startIdx.toString());
    formData.append("format_type", settings.formatType);

        const xhr = new XMLHttpRequest();

    // Track actual upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = new Blob([xhr.response], { type: 'application/pdf' });
        setResultUrl(window.URL.createObjectURL(blob));
        setLoading(false);
      } else {
        alert("Sovereign Error: Matrix sequence failed");
        setLoading(false);
      }
    };

    xhr.onerror = () => {
      alert("Sovereign Error: Connection Lost.");
      setLoading(false);
    };

    xhr.open("POST", `${API_BASE}/add-page-numbers`);
    xhr.responseType = "blob";
    xhr.send(formData);
  };

  return (
    <div className="flex h-screen bg-[#050412] text-white font-sans selection:bg-[#CC208E]/30 overflow-hidden">
      
      {/* LEFT: CONTROL RIBBON */}
      <aside className="w-80 border-r border-white/10 p-8 flex flex-col z-20 backdrop-blur-xl bg-black/40">
        <div className="mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CC208E] to-[#6713D2]" />
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Arcane_Num</h2>
        </div>

        <Link href="/" className="flex items-center gap-2 mb-10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#CC208E] transition-all">
          <ArrowLeft size={14} /> Hub_Sequence
        </Link>

        <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
          <section className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
              <Layout size={12} /> Alignment_Matrix
            </label>
            <div className="grid grid-cols-1 gap-2">
                {[
                    { id: "bottom_left", label: "Bottom Left" },
                    { id: "bottom_center", label: "Bottom Middle" },
                    { id: "bottom_right", label: "Bottom Right" }
                ].map((pos) => (
                    <button
                        key={pos.id}
                        onClick={() => setSettings({...settings, position: pos.id})}
                        className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            settings.position === pos.id 
                            ? "bg-[#CC208E] border-[#CC208E] text-white" 
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                        }`}
                    >
                        {pos.label}
                    </button>
                ))}
            </div>
          </section>

          <section className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
              <Hash size={12} /> Number_Protocol
            </label>
            <select 
              value={settings.formatType}
              onChange={(e) => setSettings({...settings, formatType: e.target.value})}
              className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs outline-none focus:border-[#CC208E]/50 transition-all appearance-none cursor-pointer"
            >
              <option value="standard" className="bg-[#050412]">Standard (1, 2, 3)</option>
              <option value="x_of_y" className="bg-[#050412]">Detailed (Page X of Y)</option>
              <option value="roman" className="bg-[#050412]">Classical (i, ii, iii)</option>
            </select>
          </section>

          <section className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
              <Palette size={12} /> Core_Color
            </label>
            <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                <input 
                  type="color" 
                  value={settings.color}
                  onChange={(e) => setSettings({...settings, color: e.target.value})}
                  className="w-10 h-10 bg-transparent border-none cursor-pointer rounded-lg"
                />
                <span className="text-[10px] font-mono text-slate-400">{settings.color.toUpperCase()}</span>
            </div>
          </section>
        </div>

        <button 
          onClick={handleApplyNumbering}
          disabled={!file || loading}
          className="mt-8 w-full py-5 bg-[#CC208E] rounded-full font-black text-xs uppercase italic hover:brightness-110 disabled:opacity-30 transition-all shadow-xl shadow-[#CC208E]/20"
        >
          {loading ? "Distilling..." : "Apply Numbering"}
        </button>
      </aside>

      {/* MAIN WORKSPACE */}
      <main 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#100654] via-[#050412] to-[#050412]"
      >
        <AnimatePresence>
            {isDragging && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-[#CC208E]/10 backdrop-blur-md border-4 border-dashed border-[#CC208E] m-10 rounded-[3rem] flex flex-col items-center justify-center pointer-events-none"
                >
                    <UploadCloud size={80} className="text-[#CC208E] animate-bounce" />
                    <p className="mt-4 font-black uppercase italic tracking-[0.3em]">Release to Inject</p>
                </motion.div>
            )}
        </AnimatePresence>

        <div className={`relative aspect-[1/1.414] h-[85vh] rounded-[2rem] overflow-hidden border border-white/5 bg-[#0d0d0f]/60 shadow-2xl transition-all duration-500 ${loading ? "scale-95 opacity-50 blur-sm" : "scale-100 opacity-100"}`}>
          {previewUrl ? (
            <embed src={`${previewUrl}#toolbar=0`} className="w-full h-full" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-10">
               <input type="file" accept=".pdf" id="num-up" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
               <label htmlFor="num-up" className="cursor-pointer group flex flex-col items-center gap-6">
                  <div className="p-10 rounded-[3rem] border-2 border-dashed border-white/10 group-hover:border-[#CC208E]/50 group-hover:bg-[#CC208E]/5 transition-all duration-500">
                    <FileUp size={64} className="text-[#CC208E] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 italic mb-2">Inject_PDF_Shard</span>
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-loose">Drag & Drop or Click to Browse</span>
                  </div>
               </label>
            </div>
          )}
        </div>
      </main>

      {/* RESULT OVERLAY */}
      <AnimatePresence>
        {resultUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center">
            <div className="text-center space-y-8">
              <div className="relative inline-block">
                <CheckCircle size={80} className="text-[#CC208E] mx-auto" />
                <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-[#CC208E] rounded-full blur-2xl -z-10" 
                />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter">Numbers_Aligned</h2>
              <a href={resultUrl} download="arcane_numbered.pdf" className="flex items-center gap-4 px-12 py-6 bg-[#CC208E] rounded-full font-black text-xl uppercase italic shadow-2xl hover:scale-105 transition-all">
                <Download /> Download Asset
              </a>
              <button onClick={() => {setResultUrl(null); setFile(null); setPreviewUrl(null);}} className="block mx-auto text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                <RefreshCcw size={14} className="inline mr-2" /> New Protocol
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
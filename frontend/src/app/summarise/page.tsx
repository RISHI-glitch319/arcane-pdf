"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BrainCircuit, FileUp, Sparkles, Sun, Moon,
  Loader2, Download, Copy, RefreshCcw, CheckCircle, Info, Activity, Eye
} from "lucide-react";
import Link from "next/link";
import axios from "axios";

/* ================= BRAND CONSTANTS ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
  bgDark: "#050412",
  bgSpotlight: "#100654"
};

/* ================= MAGNETIC CINEMATIC ENGINE ================= */
const ArchitectureBackground = React.memo(({ dark }: { dark: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let particles: any[] = [];
    let animationFrameId: number;

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 1,
          color: Math.random() > 0.5 ? "204, 32, 142" : "103, 19, 210"
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (180 - dist) / 180;
          p.x += (dx / dist) * force * 5;
          p.y += (dy / dist) * force * 5;
        }
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    init(); draw();
    const mm = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", mm);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", mm);
    };
  }, [dark]);

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
});

ArchitectureBackground.displayName = "ArchitectureBackground";

/* ================= SUMMARIZER PAGE ================= */
export default function SummarizePDF() {
  // 1. LOCAL STATE ONLY: Initialized to dark mode by default for each tab.
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const API = API_BASE;

  // 2. REFACTORED: Removed the useEffect that synced state with localStorage.

  // 3. STANDARDIZED TOGGLE: Functional update with zero storage side effects.
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  const processFile = (selected: File) => {
    if (selected && selected.type === "application/pdf") {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setSummary("");
      setDownloadUrl(null);
    } else {
      alert("Invalid matrix segment. Please inject a PDF file.");
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleSummarize = async () => {
    if (!file) return;
    setLoading(true);
    setSummary("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/summarize-pdf`, formData);
      setSummary(res.data.summary);

      const pdfRes = await axios.post(`${API}/generate-summary-pdf`, {
        text: res.data.summary,
        filename: `Distill_${file.name}`
      }, { responseType: 'blob' });

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(URL.createObjectURL(new Blob([pdfRes.data])));
    } catch (err) {
      alert("Neural Protocol Error: Matrix distillation failed.");
    } finally {
      setLoading(false);
    }
  };

  const resetEngine = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setPreviewUrl(null);
    setSummary("");
    setDownloadUrl(null);
  };

  // Memory safety: cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [previewUrl, downloadUrl]);

  return (
    <main className={`min-h-screen relative flex flex-col font-sans transition-all duration-700 overflow-hidden ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}>
      <ArchitectureBackground dark={dark} />

      {/* TOP NAVBAR */}
      <nav className={`w-full h-[70px] flex items-center justify-between px-8 border-b backdrop-blur-xl z-50 sticky top-0 ${dark ? 'border-white/10' : 'border-slate-200 shadow-sm bg-white/80'}`}>
        <div className="flex items-center gap-3 font-bold text-lg uppercase tracking-tighter">
          <span style={{ color: BRAND.magenta }} className="italic font-black">Arcane</span>
          <span className={dark ? "text-white" : "text-black"}>Summary</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/" className={`text-[10px] font-black uppercase opacity-40 hover:opacity-100 flex items-center gap-2 transition-all ${dark ? 'text-white' : 'text-black'}`}>
            <ArrowLeft size={14} /> Back to Hub
          </Link>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all ${dark ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-slate-100 border border-slate-200 hover:bg-slate-200'}`}>
            {dark ? <Sun size={18} className="text-[#CC208E]" /> : <Moon size={18} className="text-[#CC208E]" />}
          </button>
        </div>
      </nav>

      {/* WORKSPACE */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 overflow-hidden">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl text-center">
            <input type="file" accept=".pdf" id="sum-up" className="hidden" onChange={handleUpload} />
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              htmlFor="sum-up"
              className={`cursor-pointer w-full aspect-video border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-6 transition-all 
                ${isDragging ? 'border-[#CC208E] scale-[1.02]' : 'hover:border-[#CC208E]/40'} 
                ${dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200 shadow-xl"}`}
            >
              <div className="p-6 rounded-full bg-[#CC208E]/10">
                <BrainCircuit size={48} className="text-[#CC208E] animate-pulse" />
              </div>
              <div className="space-y-2 text-center px-4">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Inject PDF Shard</h2>
                <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Drag & Drop or Click to Distill</p>
              </div>
            </label>
          </motion.div>
        ) : (
          <div className="w-full max-w-7xl grid lg:grid-cols-[1fr_420px] gap-8 items-stretch h-full max-h-[85vh]">

            {/* LEFT: LIVE PDF PREVIEW AREA */}
            <div className={`relative rounded-[3rem] border overflow-hidden transition-all shadow-2xl ${dark ? "border-white/5 bg-black" : "border-slate-300 bg-slate-200"}`}>
              {previewUrl && (
                <div className="w-full h-full relative">
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0`}
                    className={`w-full h-full border-none transition-all duration-1000 ${loading ? 'blur-md grayscale opacity-20' : 'opacity-100'}`}
                  />
                  <div className="absolute top-6 left-6 px-4 py-1.5 rounded-full bg-[#CC208E] text-[10px] font-black text-white uppercase shadow-lg z-20">
                    Neural Preview Ready
                  </div>
                </div>
              )}

              <AnimatePresence>
                {loading && (
                  <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 w-full h-[4px] bg-[#CC208E] shadow-[0_0_30px_6px_#CC208E]"
                    />
                    <div className="relative z-40 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-3xl flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-[#CC208E]" size={32} />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Synthesizing Fidelity Matrix...</span>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT: CONTROL MATRIX & OUTPUT */}
            <div className="flex flex-col gap-6 overflow-hidden">
              <div className={`p-8 rounded-[2.5rem] border backdrop-blur-2xl transition-all ${dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-[#CC208E]/20 flex items-center justify-center text-[#CC208E]"><Sparkles size={20} /></div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] font-bold opacity-40 uppercase">Current Asset</p>
                    <h3 className="text-xs font-black uppercase italic truncate">{file.name}</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={handleSummarize}
                    disabled={loading || !!summary}
                    className="w-full py-5 rounded-2xl bg-[#CC208E] text-white font-black uppercase italic transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 shadow-xl shadow-[#CC208E]/20"
                  >
                    {loading ? <Activity className="animate-spin mx-auto" /> : summary ? "Distillation Complete" : "Begin Summarisation"}
                  </button>

                  {summary && (
                    <motion.a
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      href={downloadUrl || "#"}
                      download={`Distill_Summary_${file.name}`}
                      className="w-full py-5 rounded-2xl border-2 border-[#CC208E] text-[#CC208E] font-black uppercase italic flex items-center justify-center gap-2 hover:bg-[#CC208E] hover:text-white transition-all shadow-lg"
                    >
                      <Download size={18} /> Download High-Fidelity PDF
                    </motion.a>
                  )}

                  <button onClick={resetEngine} className="w-full mt-4 text-[9px] font-black uppercase opacity-30 hover:opacity-100 flex items-center justify-center gap-2 transition-all">
                    <RefreshCcw size={12} /> Reset Engine
                  </button>
                </div>
              </div>

              {/* NEURAL OUTPUT TERMINAL */}
              <div className={`flex-1 p-8 rounded-[2.5rem] border overflow-y-auto custom-scrollbar transition-all ${dark ? "bg-black/60 border-white/5 shadow-2xl" : "bg-slate-50 border-slate-200 shadow-inner"}`}>
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                  <label className="text-[10px] font-black uppercase opacity-30 tracking-[0.3em] italic">Neural Output Stream</label>
                  {summary && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="text-[#CC208E] hover:scale-110 transition-transform"
                    >
                      {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                  )}
                </div>

                <div className={`text-base leading-relaxed italic font-medium selection:bg-[#CC208E]/30 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {summary ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }}>
                      {summary}
                    </motion.div>
                  ) : (
                    <div className="space-y-4 opacity-20">
                      <p>Awaiting distillation pulse...</p>
                      <div className={`h-2 w-full rounded-full animate-pulse ${dark ? 'bg-white/10' : 'bg-black/10'}`} />
                      <div className={`h-2 w-2/3 rounded-full animate-pulse ${dark ? 'bg-white/10' : 'bg-black/10'}`} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CC208E; border-radius: 10px; }
        iframe { color-scheme: ${dark ? 'dark' : 'light'}; }
      `}</style>
    </main>
  );
}
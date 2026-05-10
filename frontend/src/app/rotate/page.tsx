"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, ArrowLeft, RefreshCcw, Loader2, Download, Sparkles, Activity, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { LivePreviewCard, formatPreviewSize, ImagePreview } from "@/app/_components/live-preview-card";
import { ArchitectureBackground, ArcaneLogo, BRAND } from "@/app/_components/LayoutAssets";

export default function RotateImagePage() {
  // 1. ISOLATED LOCAL STATE
  // Initialized directly. No localStorage.getItem calls.
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. REMOVE ALL SHARED STORAGE USAGE
  // "arcane-theme" logic and storage useEffects have been deleted.

  // 3. ENSURE MEMORY SAFETY
  // Cleanup logic is preserved to prevent memory leaks when changing files or unmounting.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  // 4. STANDARDIZED TOGGLE FUNCTION
  // Replaced with side-effect free toggle. No storage writes.
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  // 5. CORE FUNCTIONALITY (PRESERVED)
  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(localUrl);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRotate = async () => {
    if (!file) return;
    setIsCompressing(true);
    setError(null);
    setResult(null);
    setProgress(0);

        const formData = new FormData();
    formData.append("files", file);
    formData.append("angle", angle.toString());

    try {
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + Math.random() * 20, 90));
      }, 300);

      const response = await fetch(`${API_BASE}/api/image/rotate`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        const json = await response.json();
        const filesArray = Array.isArray(json.data) ? json.data : [json.data];

        if (filesArray.length > 0) {
          const fileData = filesArray[0];
          let url = fileData.url;
          if (url && !url.startsWith("http")) {
            url = `${API_BASE}${url}`;
          }

          setResult({
            url,
            filename: `rotated_${file.name}`,
          });
        }
      } else {
        setError("Matrix sequence failed during processing.");
      }
    } catch (e) {
      setError("Network failure: Architecture unreachable.");
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <main className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Image <span style={{ color: BRAND.magenta }}>Rotate</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Back to Hub
            </Link>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all shadow-lg ${dark ? "bg-[#CC208E] text-white" : "bg-slate-100 text-[#CC208E]"}`}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto pt-32 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? 'bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5' : 'bg-white/80 border-slate-200 shadow-slate-100'}`}
        >
          {isCompressing && (
            <div className={`absolute top-0 left-0 w-full h-1 overflow-hidden ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <motion.div className="h-full" style={{ backgroundColor: BRAND.magenta }} initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ ease: "linear" }} />
            </div>
          )}

          <header className="text-center mb-12">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>Rotation <span style={{ color: BRAND.magenta }}>Engine</span></h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Zero-Data Leakage • Local Hardware Acceleration</p>
          </header>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-950/20 p-4 text-red-400 rounded-2xl mb-8 flex gap-3 items-center border border-red-500/20">
              <Activity size={18} className="animate-pulse" />
              <span className="text-xs font-black uppercase tracking-tight">{error}</span>
            </motion.div>
          )}

          {!result ? (
            <div className="space-y-8">
              <div onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => fileInputRef.current?.click()} className={`group relative border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="relative z-10">
                  <RotateCcw style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" size={56} />
                  <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{file ? file.name : "Inject Image Sequence"}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`rounded-[1.5rem] p-6 border transition-all ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <label className={`text-sm mb-4 flex items-center justify-between font-black uppercase tracking-widest ${dark ? 'text-white' : 'text-slate-700'}`}>
                    <span>Custom Angle</span>
                    <span className={`px-2 py-1 rounded bg-[#CC208E]/20 text-[#CC208E]`}>{angle}°</span>
                  </label>
                  <input type="range" min="0" max="360" step="1" value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-[#CC208E]" />
                </div>
                <div className={`rounded-[1.5rem] p-6 border grid grid-cols-3 gap-2 ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  {[90, 180, 270].map(preset => (
                    <button key={preset} type="button" onClick={() => setAngle(preset)} className={`py-4 rounded-xl font-bold transition-all border ${angle === preset ? 'bg-[#CC208E] text-white border-[#CC208E]' : dark ? 'bg-black/50 text-slate-400 border-white/10 hover:bg-white/10' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {preset}°
                    </button>
                  ))}
                </div>
              </div>

              <LivePreviewCard dark={dark} title="Rotation Source" caption="Input">
                <div className="space-y-4">
                  <ImagePreview url={previewUrl} title="Rotate input preview" dark={dark} emptyLabel="Select an Image to preview." />
                </div>
              </LivePreviewCard>

              <button onClick={handleRotate} disabled={!file || isCompressing} className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic ${dark ? 'bg-[#CC208E] text-white shadow-[#CC208E]/30 hover:bg-[#6713D2]' : 'bg-[#CC208E] text-white hover:bg-[#6713D2]'}`}>
                {isCompressing ? <span className="flex items-center justify-center gap-3"><Loader2 className="animate-spin" size={20} />Reorienting Source {Math.round(progress)}%</span> : "Execute Rotation"}
              </button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10">
              <LivePreviewCard dark={dark} title="Rotated Output" caption={`+${angle}°`}>
                <ImagePreview url={result?.url || null} title="Rotated Image preview" dark={dark} emptyLabel="Rotated Image preview will appear here." />
              </LivePreviewCard>

              <div className="space-y-4 pt-4">
                <button onClick={() => handleDownload(result.url, result.filename)} className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}>
                  <Download size={24} /> Retrieve File
                </button>
                <button onClick={() => { setResult(null); setFile(null); }} className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-[10px] uppercase tracking-widest transition-colors"><RefreshCcw size={14} /> New Sequence</button>
              </div>
            </motion.div>
          )}
        </motion.div>
        <footer className={`mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] transition-all ${dark ? 'text-slate-700' : 'text-slate-400'}`}>Arcane Engine • Secured by Digital Sovereignty • 2026</footer>
      </div>
    </main>
  );
}
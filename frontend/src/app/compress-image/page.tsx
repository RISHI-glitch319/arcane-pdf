"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Minimize2, ArrowLeft, RefreshCcw, Loader2,
  Download, Sparkles, Activity, Moon, Sun
} from "lucide-react";
import Link from "next/link";
import { LivePreviewCard, formatPreviewSize, ImagePreview } from "@/app/_components/live-preview-card";
import { ArchitectureBackground, ArcaneLogo, BRAND } from "@/app/_components/LayoutAssets";

export default function CompressImagePage() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(85);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedPreviewUrl, setCompressedPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ================= THEME SYNC ================= */
  useEffect(() => {
    const savedTheme = sessionStorage.getItem("arcane-theme");
    if (savedTheme !== null) setDark(savedTheme === "true");
  }, []);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    sessionStorage.setItem("arcane-theme", String(newTheme));
  };

  /* ================= PREVIEW CLEANUP & SYNC ================= */
  // Handle Source Preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  // Handle Compressed Preview URL Cleanup
  useEffect(() => {
    return () => {
      if (compressedPreviewUrl) URL.revokeObjectURL(compressedPreviewUrl);
    };
  }, [compressedPreviewUrl]);

  /* ================= HANDLERS ================= */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDownload = () => {
    if (!compressedPreviewUrl || !result) return;
    const a = document.createElement("a");
    a.href = compressedPreviewUrl;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsCompressing(true);
    setError(null);
    setResult(null);

    // Revoke old local URL if it exists
    if (compressedPreviewUrl) URL.revokeObjectURL(compressedPreviewUrl);
    setCompressedPreviewUrl(null);
    setProgress(0);

        const formData = new FormData();
    formData.append("files", file);
    formData.append("quality", quality.toString());

    try {
      // Fake progress incrementing while waiting for server response
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + Math.random() * 15, 85));
      }, 200);

      const response = await fetch(`${API_BASE}/api/image/compress`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const json = await response.json();
        const filesArray = Array.isArray(json.data) ? json.data : [json.data];

        if (filesArray.length > 0) {
          const fileData = filesArray[0];
          let downloadUrl = fileData.url;

          // Ensure URL is absolute for the internal fetch
          if (downloadUrl && !downloadUrl.startsWith("http")) {
            downloadUrl = `${API_BASE}${downloadUrl}`;
          }

          // CRITICAL FIX: Fetch actual blob to create a reliable local URL for preview and download
          const fileResponse = await fetch(downloadUrl);
          const imageBlob = await fileResponse.blob();
          const localUrl = URL.createObjectURL(imageBlob);

          setCompressedPreviewUrl(localUrl);
          setProgress(100);

          setResult({
            filename: `compressed_${file.name}`,
            reduction: fileData.reduction_percentage,
            compressed_size: fileData.compressed_size,
            original_size: fileData.original_size
          });
        }
      } else {
        setError("Matrix sequence failed during processing.");
      }
    } catch (e) {
      console.error(e);
      setError("Network failure: Architecture unreachable.");
    } finally {
      setIsCompressing(false);
    }
  };

  const resetSequence = () => {
    setResult(null);
    setFile(null);
    if (compressedPreviewUrl) URL.revokeObjectURL(compressedPreviewUrl);
    setCompressedPreviewUrl(null);
    setProgress(0);
  };

  return (
    <main
      className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* NAVIGATION */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Image <span style={{ color: BRAND.magenta }}>Compress</span>
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
          {/* TOP PROGRESS GLOW */}
          {isCompressing && (
            <div className={`absolute top-0 left-0 w-full h-1 overflow-hidden ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <motion.div className="h-full" style={{ backgroundColor: BRAND.magenta }} initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ ease: "linear" }} />
            </div>
          )}

          <header className="text-center mb-12">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>Compression <span style={{ color: BRAND.magenta }}>Engine</span></h1>
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
              {/* DROPZONE */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="relative z-10">
                  <Minimize2 style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" size={56} />
                  <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{file ? file.name : "Inject Image Sequence"}</p>
                </div>
              </div>

              {/* QUALITY SLIDER */}
              <div className={`p-6 rounded-2xl border transition-all ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs uppercase font-black tracking-widest ${dark ? 'text-white' : 'text-slate-700'}`}>Target Quality</span>
                  <span className={`text-[#CC208E] font-black`}>{quality}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-[#CC208E] cursor-pointer"
                />
              </div>

              <LivePreviewCard dark={dark} title="Format Source" caption="Input">
                <div className="space-y-4">
                  <ImagePreview url={previewUrl} title="Compress input preview" dark={dark} emptyLabel="Select an Image to preview." />
                </div>
              </LivePreviewCard>

              <button
                onClick={handleCompress}
                disabled={!file || isCompressing}
                className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic ${dark ? 'bg-[#CC208E] text-white shadow-[#CC208E]/30 hover:bg-[#6713D2]' : 'bg-[#CC208E] text-white hover:bg-[#6713D2]'}`}
              >
                {isCompressing ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={20} />
                    Transforming Base {Math.round(progress)}%
                  </span>
                ) : "Execute Compression"}
              </button>
            </div>
          ) : (
            /* CINEMATIC RESULT SCREEN */
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10">
              <LivePreviewCard dark={dark} title="Compressed Output" caption={`Optimized ${result.reduction ? `-${result.reduction}%` : ''}`}>
                <ImagePreview url={compressedPreviewUrl} title="Compressed Image preview" dark={dark} emptyLabel="Generating Preview..." />
              </LivePreviewCard>

              <div className={`p-4 rounded-xl border text-center font-black uppercase tracking-widest text-[10px] ${dark ? 'border-green-500/30 bg-green-950/20 text-green-400' : 'border-green-300 bg-green-50 text-green-700'}`}>
                Original: {formatPreviewSize(result.original_size)} → Compressed: {formatPreviewSize(result.compressed_size)} (-{result.reduction}%)
              </div>

              <div className="space-y-4 pt-4">
                <button
                  onClick={handleDownload}
                  className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}
                >
                  <Download size={24} /> Retrieve File
                </button>
                <button
                  onClick={resetSequence}
                  className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  <RefreshCcw size={14} /> New Sequence
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>

        <footer className={`mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] transition-all ${dark ? 'text-slate-700' : 'text-slate-400'}`}>
          Arcane Engine • Secured by Digital Sovereignty • 2026
        </footer>
      </div>
    </main>
  );
}
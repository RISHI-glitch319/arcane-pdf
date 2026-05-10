"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, FileUp, RefreshCcw, Activity,
  Target, Layers, Sun, Moon, FileText
} from "lucide-react";
import Link from "next/link";

/* ================= BRAND CONSTANTS ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
  bgDark: "#050412",
  bgSpotlight: "#100654"
};

/* ================= PARTICLE ENGINE ================= */
const ArchitectureBackground = ({ dark }: { dark: boolean }) => {
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
      for (let i = 0; i < 80; i++) {
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
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    init(); draw();
    const mm = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", mm);
    return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener("mousemove", mm); };
  }, [dark]);

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
};

export default function WatermarkPDF() {
  // 1. ISOLATED LOCAL STATE (No Storage retrieval)
  const [dark, setDark] = useState(true);
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState("center");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // 2. REMOVED ALL SHARED STORAGE USAGE
  // "arcane-theme" logic and storage-based useEffects deleted.

  // 3. STANDARDIZED TOGGLE (Pure state, no side effects)
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  // 4. MEMORY SAFETY (Cleanup Logic)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  const handleFileAction = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected?.type === "application/pdf") {
      // Manual cleanup of existing URL before setting new one
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleApply = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("text", wmText);
    formData.append("opacity", opacity.toString());
    formData.append("rotation", rotation.toString());
    formData.append("font_size", fontSize.toString());
    formData.append("color", BRAND.magenta);
    formData.append("mode", mode);

    try {
      const res = await fetch(`${API_BASE}/watermark-pdf`, { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const blob = await res.blob();

      // Revoke old result if it exists to preserve memory
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob));
    } catch {
      alert("Sovereign Matrix Failure: Protocol Interrupted");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`min-h-screen relative flex flex-col font-sans transition-colors duration-700 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}>
      <ArchitectureBackground dark={dark} />

      {/* TOP NAVBAR */}
      <nav className="w-full h-[70px] flex items-center justify-between px-8 border-b border-white/10 backdrop-blur-xl z-30 sticky top-0">
        <div className="flex items-center gap-3 font-bold text-lg">
          <span style={{ color: BRAND.magenta }} className="italic font-black uppercase tracking-tighter">Arcane</span>
          <span className="font-light">PDF</span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            <ArrowLeft size={16} />
            Back
          </Link>
          <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            {dark ? <Sun size={18} className="text-[#CC208E]" /> : <Moon size={18} className="text-[#CC208E]" />}
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* VIEWPORT AREA */}
        <section className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12">
          {!file ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
              <input type="file" accept=".pdf" id="pdf-upload" className="hidden" onChange={handleFileAction} />
              <label htmlFor="pdf-upload" className={`cursor-pointer w-full aspect-video border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-6 transition-all hover:border-[#CC208E]/40 ${dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <div className="p-6 rounded-full bg-[#CC208E]/10">
                  <FileUp size={48} className="text-[#CC208E] animate-bounce" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Inject PDF Document</h2>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">Sovereign Matrix Awaiting Asset</p>
                </div>
              </label>
            </motion.div>
          ) : (
            <div className={`relative aspect-[1/1.414] h-[78vh] rounded-[2.5rem] shadow-2xl border overflow-hidden transition-all ${dark ? "bg-black/40 border-white/10" : "bg-white border-slate-200"}`}>
              {previewUrl && <iframe src={`${previewUrl}#toolbar=0&navpanes=0`} className="w-full h-full opacity-40 grayscale" />}

              {/* LIVE UI PREVIEW OVERLAY */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <motion.div
                  animate={{ opacity, rotate: -rotation }}
                  style={{ fontSize: `${fontSize * 0.8}px`, color: BRAND.magenta }}
                  className="font-black uppercase italic drop-shadow-2xl text-center px-10 select-none"
                >
                  {wmText}
                </motion.div>
              </div>
            </div>
          )}
        </section>

        {/* CONTROL MATRIX (RIGHT SIDEBAR) */}
        <aside className={`w-[380px] border-l p-10 flex flex-col backdrop-blur-3xl transition-all ${dark ? "bg-black/40 border-white/5" : "bg-white/80 border-slate-200"}`}>
          <div className="mb-10">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase underline decoration-[#CC208E] decoration-4 underline-offset-8">Distill</h2>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-4">Watermark Matrix Engine</p>
          </div>

          <div className="space-y-10 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {/* POSITION MODE */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] italic">Projection Mode</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                <button onClick={() => setMode("center")} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'center' ? 'bg-[#CC208E] text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}>Center</button>
                <button onClick={() => setMode("tile")} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'tile' ? 'bg-[#CC208E] text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}>Tile</button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] italic">Content Shard</label>
              <input value={wmText} onChange={(e) => setWmText(e.target.value.toUpperCase())} className={`w-full p-4 rounded-xl text-xs font-bold transition-all outline-none border ${dark ? "bg-white/5 border-white/10 text-[#CC208E] focus:border-[#CC208E]" : "bg-white border-slate-200 text-[#CC208E] focus:border-[#CC208E]"}`} />
            </div>

            {/* SLIDERS */}
            {[
              { label: "Font Scale", val: fontSize, set: setFontSize, min: 10, max: 200, unit: "px" },
              { label: "Rotation Matrix", val: rotation, set: setRotation, min: -180, max: 180, unit: "°" },
              { label: "Opacity Flux", val: Math.round(opacity * 100), set: (v: any) => setOpacity(v / 100), min: 0, max: 100, unit: "%" }
            ].map((slider) => (
              <div key={slider.label} className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] italic">{slider.label}</label>
                  <span className="text-[10px] font-black text-[#CC208E]">{slider.val}{slider.unit}</span>
                </div>
                <input type="range" min={slider.min} max={slider.max} value={slider.val} onChange={(e) => slider.set(parseInt(e.target.value))} className="w-full accent-[#CC208E] cursor-pointer" />
              </div>
            ))}
          </div>

          <button
            onClick={handleApply}
            disabled={!file || loading}
            className="mt-10 w-full py-6 rounded-3xl bg-[#CC208E] text-white font-black uppercase italic tracking-tighter hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#CC208E]/20 transition-all disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {loading ? <Activity className="animate-spin" /> : "Commit Stamp"}
          </button>
        </aside>
      </div>

      {/* RESULT MODAL */}
      <AnimatePresence>
        {resultUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 text-center">
            <div className="space-y-8 max-w-lg">
              <div className="p-10 rounded-[4rem] bg-[#CC208E]/10 border border-[#CC208E]/20 inline-block relative overflow-hidden">
                <ShieldCheck size={100} className="text-[#CC208E]" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white">Asset Solidified</h2>
              <div className="flex flex-col gap-4">
                <a href={resultUrl} download="arcane_stamped_asset.pdf" className="block w-full bg-[#CC208E] text-white py-6 rounded-full font-black text-2xl hover:brightness-110 transition-all uppercase italic shadow-2xl">Download Result</a>
                <button onClick={() => { setResultUrl(null); setFile(null); }} className="text-slate-500 font-black text-[10px] tracking-widest uppercase hover:text-white transition-colors flex items-center gap-2 mx-auto">
                  <RefreshCcw size={14} /> Wipe Memory & Reset
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
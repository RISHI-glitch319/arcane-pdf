"use client";


import { API_BASE } from "@/config/api";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus, Plus, Trash2, Loader2, FileText,
  ArrowLeft, CheckCircle, RefreshCcw, Moon, Sun,
  Sparkles, Activity, Download
} from "lucide-react";
import Link from "next/link";

/* ================= BRAND CONSTANTS ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
  bgDark: "#050412",
  bgSpotlight: "#100654"
};

/* ================= ARCANE SHIELD LOGO ================= */
const ArcaneLogo = ({ dark }: { dark: boolean }) => (
  <svg viewBox="0 0 100 100" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={BRAND.magenta} />
        <stop offset="100%" stopColor={BRAND.purple} />
      </linearGradient>
    </defs>
    <path
      d="M50 5L90 25V75L50 95L10 75V25L50 5Z"
      stroke="url(#brandGradient)"
      strokeWidth="6"
      strokeLinejoin="round"
      style={{ filter: dark ? `drop-shadow(0px 0px 10px ${BRAND.magenta})` : "none" }}
    />
    <text x="50%" y="65%" textAnchor="middle" fontWeight="900" fontSize="35" fontFamily="sans-serif">
      <tspan fill={BRAND.magenta}>A</tspan>
      <tspan fill={dark ? "#ffffff" : BRAND.bgDark}>R</tspan>
    </text>
  </svg>
);

/* ================= MAGNETIC CINEMATIC ENGINE (BACKGROUND) ================= */
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
      const particleCount = 70;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 1,
          color: Math.random() > 0.5 ? "204, 32, 142" : "103, 19, 210"
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.3" : "0.1"})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    init(); draw();
    window.addEventListener("resize", init);
    const handleMM = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", handleMM);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", handleMM);
    };
  }, [dark]);

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
};

/* ================= MAIN ORGANIZE PDF PAGE ================= */
export default function OrganizePDF() {
  const [dark, setDark] = useState(true);
  
  const [pages, setPages] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

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

  /* ================= PREVIEW CLEANUP ================= */
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  /* ================= CORE FUNCTIONS ================= */

  const onAddFile = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/analyze-pdf`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      const pagesToInsert = data.pages.map((p: any) => ({
        ...p,
        id: `pg-${crypto.randomUUID()}`,
        sourceFile: file,
        originalIdx: p.id,
        type: "file"
      }));

      const newPages = [...pages];
      newPages.splice(index + 1, 0, ...pagesToInsert);
      setPages(newPages);

    } catch (err) {
      alert("Sovereign Protocol Failure: Matrix Injection Blocked");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addBlank = (index: number) => {
    const newPages = [...pages];
    newPages.splice(index + 1, 0, {
      id: `blank-${crypto.randomUUID()}`,
      type: "blank",
      image: null
    });
    setPages(newPages);
  };

  const movePage = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...pages];
    const [item] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, item);
    setPages(updated);
  };

  const handleCommit = async () => {
    if (pages.length === 0) return;
    setLoading(true);

    const formData = new FormData();
    const orderMap: any[] = [];
    const fileMap = new Map<string, number>();

    pages.forEach((page) => {
      if (page.type === "blank") {
        orderMap.push({ type: "blank" });
      } else {
        if (!fileMap.has(page.sourceFile.name)) {
          fileMap.set(page.sourceFile.name, fileMap.size);
          formData.append("files", page.sourceFile);
        }

        orderMap.push({
          type: "file",
          file_idx: fileMap.get(page.sourceFile.name),
          p_idx: page.originalIdx
        });
      }
    });

    formData.append("page_order", JSON.stringify(orderMap));

    try {
      const res = await fetch(`${API_BASE}/organize-pdf`, {
        method: "POST",
        body: formData
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

    } catch (err) {
      alert("Commit Failure: Matrix collapse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Arcane <span style={{ color: BRAND.magenta }}>Organize</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Hub
            </Link>
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-[#CC208E] transition-all">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto pt-32 p-6 md:p-12 grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10 min-h-[calc(100vh-128px)]">

        {/* LEFT: CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`p-8 rounded-[2.5rem] border backdrop-blur-3xl shadow-2xl ${dark ? 'bg-[#0d0d0f]/60 border-white/5' : 'bg-white/80 border-slate-200'}`}>
            <h1 className={`text-2xl font-black uppercase italic tracking-tighter mb-6 ${dark ? 'text-white' : 'text-slate-900'}`}>
              Protocol <span style={{ color: BRAND.magenta }}>Matrix</span>
            </h1>

            <div className={`p-6 rounded-[2rem] border border-dashed transition-all mb-6 ${dark ? 'border-white/10 bg-white/5 hover:border-[#CC208E]/40' : 'border-slate-200 bg-slate-50 hover:border-[#CC208E]/40'}`}>
              <input type="file" accept=".pdf" id="main-upload" className="hidden" onChange={(e) => onAddFile(e, pages.length - 1)} />
              <label htmlFor="main-upload" className="cursor-pointer flex flex-col items-center gap-3 font-black uppercase text-[10px] tracking-widest" style={{ color: BRAND.magenta }}>
                <FilePlus size={32} /> Load Asset
              </label>
            </div>

            <button
              onClick={handleCommit}
              disabled={pages.length === 0 || loading}
              style={{ backgroundColor: pages.length === 0 ? 'transparent' : BRAND.magenta }}
              className={`w-full py-6 rounded-full font-black text-xl transition-all uppercase italic shadow-xl ${pages.length === 0 ? 'bg-white/5 border border-white/5 text-slate-600' : 'text-white hover:brightness-110 shadow-[#CC208E]/20'}`}
            >
              {loading ? "Distilling..." : "Commit Matrix"}
            </button>
          </div>

          <div className={`p-6 rounded-[2rem] border flex items-center gap-4 ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <Sparkles size={20} style={{ color: BRAND.magenta }} className="animate-pulse" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
              Local Re-ordering Engine Enabled. Drag and drop shards to adjust.
            </p>
          </div>
        </div>

        {/* RIGHT: FLUID GRID AREA */}
        <div className={`lg:col-span-3 border rounded-[3rem] p-8 overflow-y-auto custom-scrollbar relative shadow-2xl backdrop-blur-md min-h-[500px] ${dark ? 'bg-black/20 border-white/5' : 'bg-white/40 border-slate-200'}`}>
          {isAnalyzing && (
            <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-[3rem]">
              <div className="text-center">
                <Loader2 className="animate-spin text-white mx-auto mb-4" size={48} />
                <p className="text-white font-black uppercase tracking-widest text-xs">Analyzing PDF Matrix...</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-12 gap-x-6">
            <AnimatePresence>
              {pages.map((page, idx) => (
                <motion.div
                  key={page.id}
                  layout
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIdx !== null) movePage(draggedIdx, idx);
                    setDraggedIdx(null);
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  whileHover={{ y: -5 }}
                  className={`group relative aspect-[1/1.4] rounded-2xl overflow-hidden border cursor-grab active:cursor-grabbing transition-all ${dark ? 'bg-[#161618] border-white/10' : 'bg-slate-100 border-slate-200 shadow-sm'} ${draggedIdx === idx ? 'opacity-30' : 'opacity-100'}`}
                >
                  {page.type === 'blank' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white text-slate-300">
                      <FilePlus size={24} className="mb-2 opacity-20" />
                      <span className="font-black text-[10px] uppercase italic">Blank Shard</span>
                    </div>
                  ) : (
                    <img src={page.image} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="" />
                  )}

                  {/* CONTROLS OVERLAY */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end">
                      <button onClick={() => setPages(pages.filter(p => p.id !== page.id))} className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 shadow-lg">
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="flex gap-2 justify-center">
                      <button onClick={() => addBlank(idx)} className="p-2 bg-emerald-500 text-white rounded-full hover:scale-110 shadow-lg" title="Add Blank Page">
                        <Plus size={14} />
                      </button>
                      <label className="p-2 bg-[#6713D2] text-white rounded-full hover:scale-110 cursor-pointer shadow-lg" title="Inject PDF Here">
                        <FileText size={14} />
                        <input type="file" className="hidden" accept=".pdf" onChange={(e) => onAddFile(e, idx)} />
                      </label>
                    </div>

                    <div className="text-[8px] font-black text-white/50 uppercase tracking-widest text-center">PG_{idx + 1}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {pages.length === 0 && !isAnalyzing && (
            <div className="h-full flex items-center justify-center flex-col opacity-20 py-20">
              <Activity size={48} />
              <p className="font-black text-[10px] uppercase tracking-[0.4em] mt-4 text-center">Awaiting Matrix Feed</p>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS / DOWNLOAD MODAL */}
      <AnimatePresence>
        {resultUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-[#0a0a0c]/98 backdrop-blur-3xl flex items-center justify-center p-8">
            <div className="text-center space-y-8 max-w-lg">
              <div className="p-10 rounded-[4rem] bg-[#CC208E]/10 border border-[#CC208E]/20 inline-block">
                <CheckCircle size={80} style={{ color: BRAND.magenta }} className="mx-auto" />
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white">Matrix Re-aligned</h2>
              <div className="space-y-4">
                <a href={resultUrl} download="organized_matrix.pdf" style={{ backgroundColor: BRAND.magenta }} className="block w-full text-white py-7 rounded-full font-black text-2xl hover:brightness-110 transition-all uppercase italic shadow-2xl flex items-center justify-center gap-3">
                  <Download size={24} /> Extract PDF Matrix
                </a>
                <button onClick={() => setResultUrl(null)} className="text-slate-500 font-black text-[10px] tracking-widest uppercase flex items-center gap-2 mx-auto hover:text-white transition-colors">
                  <RefreshCcw size={14} /> Re-Initialize Engine
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(204, 32, 142, 0.3); border-radius: 10px; }
      `}</style>
    </main>
  );
}
"use client";

import { API_BASE } from "@/config/api";
import { ExcelPreview } from "@/app/_components/preview/ExcelPreview";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileSpreadsheet, Download, Activity, RefreshCcw, ArrowLeft,
  Sparkles, Moon, Sun, Loader2
} from "lucide-react";
import Link from "next/link";
import { LivePreviewCard, PdfPreview, formatPreviewSize } from "@/app/_components/live-preview-card";

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
      const particleCount = window.innerWidth < 768 ? 50 : 100;
      for (let i = 0; i < particleCount; i++) {
        const colorPool = ["204, 32, 142", "103, 19, 210"];
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          color: colorPool[Math.floor(Math.random() * colorPool.length)]
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        const dxMouse = p.x - mouse.current.x;
        const dyMouse = p.y - mouse.current.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distMouse < 200) {
          const force = (200 - distMouse) / 200;
          p.x += (dxMouse / distMouse) * force * 5;
          p.y += (dyMouse / distMouse) * force * 5;
        }

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.6" : "0.3"})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (dist < 150) {
            ctx.beginPath();
            const opacity = dark ? (0.2 - dist / 1000) : (0.1 - dist / 2000);
            ctx.strokeStyle = `rgba(${p.color}, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    init(); draw();
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [dark]);

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
};

/* ================= EXCEL TO PDF PAGE ================= */
export default function ExcelToPDF() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  /* ================= THEME PERSISTENCE ================= */
  useEffect(() => {
    const savedTheme = sessionStorage.getItem("arcane-theme");
    if (savedTheme !== null) setDark(savedTheme === "true");
  }, []);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    sessionStorage.setItem("arcane-theme", String(newTheme));
  };

  /* ================= URL CLEANUP ================= */
  useEffect(() => {
    if (!downloadUrl) return;
    return () => { URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  /* ================= CORE CONVERSION LOGIC ================= */
  const handleUpload = () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        // Reserve last 10% for processing
        setProgress(Math.round(percentComplete * 0.9));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        const blob = new Blob([xhr.response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        setDownloadUrl(url);
        setLoading(false);
      } else {
        alert("Sovereign Engine Error: Excel conversion sequence failed.");
        setLoading(false);
      }
    };

    xhr.onerror = () => {
      alert("Network failure: Architecture unreachable.");
      setLoading(false);
    };

    xhr.open("POST", `${API_BASE}/excel-to-pdf`);
    xhr.responseType = "blob";
    xhr.send(formData);
  };

  return (
    <main
      className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Arcane <span style={{ color: BRAND.magenta }}>Excel</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Back to Hub
            </Link>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all shadow-lg ${dark ? `bg-[#CC208E] text-white` : "bg-slate-100 text-[#CC208E]"}`}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto pt-40 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? 'bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5' : 'bg-white/80 border-slate-200 shadow-slate-100'}`}
        >
          {/* TOP PROGRESS GLOW */}
          {loading && (
            <div className={`absolute top-0 left-0 w-full h-1 overflow-hidden ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <motion.div
                className="h-full"
                style={{ backgroundColor: BRAND.magenta }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>
          )}

          <header className="text-center mb-12">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Matrix <span style={{ color: BRAND.magenta }}>Installation</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Native Workbook Distillery • 2026 Engine</p>
          </header>

          {!downloadUrl && !loading ? (
            <div className="space-y-8">
              {/* DROPZONE */}
              <div className={`group relative border-2 border-dashed rounded-[2.5rem] p-20 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="relative z-10">
                  <FileSpreadsheet style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500" size={56} />
                  <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                    {file ? file.name : "Inject Workbook Sequence"}
                  </p>
                  <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">Protocol: Awaiting XLSX Matrix</p>
                </div>
              </div>

              {/* INTEGRATED LIVE EXCEL PREVIEW */}
              <LivePreviewCard dark={dark} title="Workbook Content Matrix" caption="Live Data">
                <div className="space-y-4">
                  <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] md:grid-cols-2 ${dark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <span>{file ? file.name : "No workbook active"}</span>
                    <span>{file ? formatPreviewSize(file.size) : "Matrix Offline"}</span>
                  </div>

                  <div className="w-full">
                    {file ? (
                      <ExcelPreview file={file} />
                    ) : (
                      <div className={`flex flex-col items-center justify-center min-h-[260px] rounded-[1.75rem] border border-dashed transition-colors ${dark ? 'border-white/10 bg-black/20 text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                        <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                        <p className="font-bold uppercase text-[10px] tracking-widest text-center px-6">
                          Live workbook content will be distilled here <br /> after injection
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </LivePreviewCard>

              <button
                onClick={handleUpload}
                disabled={!file}
                style={{ backgroundColor: BRAND.magenta }}
                className="w-full text-white py-6 rounded-[2rem] font-black text-xl hover:brightness-110 transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic"
              >
                Execute Distilling
              </button>
            </div>
          ) : loading ? (
            <div className="py-20 text-center space-y-6">
              <Activity style={{ color: BRAND.magenta }} className="mx-auto animate-spin" size={56} />
              <div>
                <p className={`font-black tracking-[0.4em] uppercase text-[10px] ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Synchronizing Matrix: {progress}%
                </p>
                <p className="text-slate-500 text-[10px] mt-2 font-bold uppercase">Allocating Sovereign Resources...</p>
              </div>
            </div>
          ) : (
            /* CINEMATIC RESULT SCREEN */
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10">
              <LivePreviewCard dark={dark} title="Generated PDF" caption="Output">
                <PdfPreview url={downloadUrl} title="Excel to PDF output preview" dark={dark} emptyLabel="Generated PDF preview appears here." />
              </LivePreviewCard>
              <div className="bg-[#CC208E]/10 p-12 rounded-[3rem] border border-[#CC208E]/20 relative overflow-hidden">
                <Download style={{ color: BRAND.magenta }} className="mx-auto mb-4" size={56} />
                <h2 className={`text-3xl font-black uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Matrix Stabilized
                </h2>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer" />
              </div>

              <div className="space-y-4">
                <a
                  href={downloadUrl!}
                  download={`arcane_matrix_${file?.name || 'compiled'}.pdf`}
                  className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}
                >
                  <Download size={24} /> Extract Compiled PDF
                </a>
                <button
                  onClick={() => { setDownloadUrl(null); setFile(null); }}
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

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(150%) skewX(-12deg); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite linear;
        }
      `}</style>
    </main>
  );
}
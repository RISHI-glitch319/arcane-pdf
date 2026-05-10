"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minimize2, ArrowLeft, RefreshCcw, Loader2, Zap,
  ShieldCheck, Gauge, Download, Sparkles, Activity,
  Moon, Sun
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
      const particleCount = window.innerWidth < 768 ? 40 : 80;
      for (let i = 0; i < particleCount; i++) {
        const colorPool = ["204, 32, 142", "103, 19, 210"];
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 1,
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

        if (distMouse < 180) {
          const force = (180 - distMouse) / 180;
          p.x += (dxMouse / distMouse) * force * 4;
          p.y += (dyMouse / distMouse) * force * 4;
        }

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (dist < 130) {
            ctx.beginPath();
            const opacity = dark ? (0.15 - dist / 1000) : (0.05 - dist / 2000);
            ctx.strokeStyle = `rgba(${p.color}, ${opacity})`;
            ctx.lineWidth = 0.5;
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

  return <div className="fixed inset-0 z-0 pointer-events-none"><canvas ref={canvasRef} /></div>;
};

/* ================= MAIN COMPRESS PAGE ================= */
export default function CompressPage() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState("medium");
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Sync theme with session storage on mount
  useEffect(() => {
    const savedTheme = sessionStorage.getItem("arcane-theme");
    if (savedTheme !== null) setDark(savedTheme === "true");
  }, []);

  // Handle Input Preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  // Cleanup Result URL
  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    sessionStorage.setItem("arcane-theme", String(newTheme));
  };

  const compressionOptions = [
    { id: "low", label: "Stable", icon: ShieldCheck, desc: "High accuracy (300 DPI)" },
    { id: "medium", label: "Balanced", icon: Gauge, desc: "Standard Engine (150 DPI)" },
    { id: "high", label: "Overdrive", icon: Zap, desc: "Maximum compression (72 DPI)" }
  ];

  const handleCompress = async () => {
    if (!file) return;
    setIsCompressing(true);
    setError(null);
    setResult(null);
    setProgress(0);

        const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        // Reserving 10% for final server processing
        setProgress(Math.round(percentComplete * 0.9));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        const blob = new Blob([xhr.response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);

        const percentage = xhr.getResponseHeader("X-Reduction-Percentage");
        const oldSize = xhr.getResponseHeader("X-Old-Size");
        const newSize = xhr.getResponseHeader("X-New-Size");

        setResult({
          url,
          oldSize: parseInt(oldSize || "0"),
          newSize: parseInt(newSize || "0"),
          percentage: parseFloat(percentage || "0"),
        });
        setIsCompressing(false);
      } else {
        setError("Matrix sequence failed during processing.");
        setIsCompressing(false);
      }
    };

    xhr.onerror = () => {
      setError("Network failure: Architecture unreachable.");
      setIsCompressing(false);
    };

    xhr.open("POST", `${API_BASE}/compress?level=${compressionLevel}`);
    xhr.responseType = "blob";
    xhr.send(formData);
  };

  return (
    <main className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, #100654 0%, #050412 40%, #050412 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Arcane <span style={{ color: BRAND.magenta }}>Compress</span>
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
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>Optimization <span style={{ color: BRAND.magenta }}>Engine</span></h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Zero-Data Leakage • Local Hardware Acceleration</p>
          </header>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-red-950/20 p-4 text-red-400 rounded-2xl mb-8 flex gap-3 items-center border border-red-500/20"
            >
              <Activity size={18} className="animate-pulse" />
              <span className="text-xs font-black uppercase tracking-tight">{error}</span>
            </motion.div>
          )}

          {!result ? (
            <div className="space-y-8">
              {/* DROPZONE */}
              <div className={`group relative border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}>
                <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="relative z-10">
                  <Minimize2 style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 group-hover:rotate-90 transition-transform duration-500" size={56} />
                  <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{file ? file.name : "Inject PDF Sequence"}</p>
                  <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">{file ? formatPreviewSize(file.size) : "Protocol: Awaiting Data"}</p>
                </div>
              </div>

              {/* GRID OPTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {compressionOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setCompressionLevel(opt.id)}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all ${compressionLevel === opt.id
                        ? `border-[#CC208E] bg-[#CC208E]/5 shadow-[0_0_20px_rgba(204,32,142,0.1)]`
                        : `${dark ? 'border-white/5 bg-white/5 hover:border-white/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`
                      }`}
                  >
                    <opt.icon className={`mb-3 ${compressionLevel === opt.id ? 'text-[#CC208E]' : 'text-slate-500'}`} size={24} />
                    <p className={`font-black uppercase text-xs tracking-widest ${dark ? 'text-white' : 'text-slate-900'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <LivePreviewCard dark={dark} title="Compression Source" caption="Input">
                <div className="space-y-4">
                  <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] md:grid-cols-2 ${dark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <span>{file ? file.name : "No PDF selected yet"}</span>
                    <span>{file ? `${formatPreviewSize(file.size)} • ${compressionLevel}` : "Choose a file to preview it"}</span>
                  </div>
                  <PdfPreview url={previewUrl} title="Compression input preview" dark={dark} emptyLabel="Select a PDF to see its live preview." />
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
                    Syncing Data {progress}%
                  </span>
                ) : "Execute Compression"}
              </button>
            </div>
          ) : (
            /* CINEMATIC RESULT SCREEN */
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10">
              <LivePreviewCard dark={dark} title="Compressed Output" caption="Output">
                <PdfPreview url={result?.url || null} title="Compressed PDF preview" dark={dark} emptyLabel="Compressed PDF preview will appear here." />
              </LivePreviewCard>

              <div>
                <div style={{ color: BRAND.magenta }} className="text-8xl font-black italic tracking-tighter drop-shadow-[0_0_15px_rgba(204,32,142,0.3)]">
                  -{result.percentage}%
                </div>
                <div className="mt-2 text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">Protocol Success: Mass Reduced</div>
              </div>

              <div className={`grid grid-cols-2 gap-4 p-8 rounded-[2.5rem] border relative overflow-hidden ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer`} />
                <div className={`border-r relative z-10 ${dark ? 'border-white/5' : 'border-slate-200'}`}>
                  <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1">Pre-Sequence</p>
                  <p className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{formatPreviewSize(result.oldSize)}</p>
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1">Post-Sequence</p>
                  <p style={{ color: BRAND.magenta }} className="text-xl font-bold">{formatPreviewSize(result.newSize)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <a
                  href={result.url}
                  download={`arcane_optimized_${file?.name || 'file'}.pdf`}
                  className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}
                >
                  <Download size={24} /> Retrieve File
                </a>
                <button onClick={() => { setResult(null); setFile(null); }} className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-[10px] uppercase tracking-widest transition-colors">
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CC208E; border-radius: 10px; }
      `}</style>
    </main>
  );
}
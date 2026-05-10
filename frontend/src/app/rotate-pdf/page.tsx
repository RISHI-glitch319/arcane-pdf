"use client";

import { API_BASE } from "@/config/api";
import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, RotateCw, CheckCircle2, RefreshCcw, FileText, Moon, Sun, Sparkles, Download } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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

/* ================= MAGNETIC CINEMATIC ENGINE ================= */
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
      const particleCount = 80;
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
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        const dxMouse = p.x - mouse.current.x;
        const dyMouse = p.y - mouse.current.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distMouse < 180) {
          const force = (180 - distMouse) / 180;
          p.x += (dxMouse / distMouse) * force * 5;
          p.y += (dyMouse / distMouse) * force * 5;
        }

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();
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

/* ================= MAIN ROTATE PDF PAGE ================= */
export default function RotatePDF() {
  // 1. LOCAL STATE ONLY: No restoration from localStorage to prevent cross-tab sync.
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  
  // 2. REMOVED: Storage effect hook completely deleted.

  // 3. STANDARDIZED TOGGLE: Functional update with zero side effects to shared storage.
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  // 4. MEMORY SAFETY: Ensure local object URLs are revoked correctly.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const handleRotateUI = () => setRotation((prev) => (prev + 90) % 360);

  const handleRotateSubmit = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE}/rotate-pdf?angle=${rotation}`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Rotation failed");
      const blob = await response.blob();
      setResultUrl(window.URL.createObjectURL(blob));
    } catch (err) {
      alert("Sovereign Engine Error: Orientation sequence interrupted.");
    } finally {
      setIsProcessing(false);
    }
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
              Arcane <span style={{ color: BRAND.magenta }}>Rotate</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Back to Hub
            </Link>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all shadow-lg ${dark ? `bg-[${BRAND.magenta}] text-white` : "bg-slate-100 text-[#CC208E]"}`}
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
          {isProcessing && (
            <div className={`absolute top-0 left-0 w-full h-1 overflow-hidden ${dark ? "bg-white/5" : "bg-slate-100"}`}>
              <motion.div
                className="h-full"
                style={{ backgroundColor: BRAND.magenta }}
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2 }}
              />
            </div>
          )}

          <header className="text-center mb-10">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-3 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Rotate <span style={{ color: BRAND.magenta }}>PDF</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Protocol: Re-align Digital Sequence Assets • 2026</p>
          </header>

          <AnimatePresence mode="wait">
            {!resultUrl ? (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className={`group relative border-2 border-dashed rounded-[2.5rem] p-10 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}>
                  <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => setFile(e.target.files?.[0] || null)} />

                  {file && previewUrl ? (
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={{ rotate: rotation }}
                        className="w-40 h-56 bg-white shadow-2xl rounded-xl border border-white/10 overflow-hidden mb-6 relative"
                      >
                        <embed src={`${previewUrl}#toolbar=0`} className="w-full h-full opacity-50" />
                        <div className="absolute inset-0 bg-transparent" />
                      </motion.div>
                      <p className={`font-black uppercase italic transition-colors ${dark ? 'text-white' : 'text-slate-900'}`}>{file.name}</p>
                    </div>
                  ) : (
                    <div className="py-10">
                      <FileText style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner" size={64} />
                      <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Inject PDF Sequence</p>
                      <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest">Protocol: Awaiting Vector Matrix</p>
                    </div>
                  )}
                </div>

                {file && (
                  <button
                    onClick={handleRotateUI}
                    className={`flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-black transition-all shadow-md active:scale-95 uppercase text-xs tracking-widest ${dark ? 'bg-white/5 border border-white/10 text-[#CC208E] hover:bg-white/10' : 'bg-slate-50 border border-slate-200 text-[#CC208E] hover:bg-slate-100'}`}
                  >
                    <RotateCw size={16} />
                    <span>Rotate 90°</span>
                  </button>
                )}

                <button
                  onClick={handleRotateSubmit}
                  disabled={!file || isProcessing}
                  style={{ backgroundColor: !file || isProcessing ? 'transparent' : BRAND.magenta }}
                  className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic ${!file || isProcessing ? 'bg-white/5 border border-white/5 text-slate-600' : 'text-white hover:brightness-110 shadow-[#CC208E]/20'}`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="animate-spin" size={20} />
                      PROCESSING...
                    </span>
                  ) : "EXECUTE ROTATION"}
                </button>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8">
                <div className={`p-10 rounded-[3rem] border relative overflow-hidden ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-100'}`}>
                  <CheckCircle2 size={64} style={{ color: BRAND.magenta }} className="mx-auto mb-4" />
                  <p className={`text-2xl font-black uppercase italic ${dark ? 'text-white' : 'text-slate-900'}`}>Sequence Realigned</p>
                  <div style={{ color: BRAND.magenta, backgroundColor: `${BRAND.magenta}20` }} className="mt-2 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.3em] inline-block uppercase">Orientation Saved</div>
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer`} />
                </div>

                <div className="space-y-4">
                  <a
                    href={resultUrl}
                    download={`arcane_rotated_${file?.name}`}
                    className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}
                  >
                    <Download size={24} /> DOWNLOAD PDF
                  </a>
                  <button
                    onClick={() => { setResultUrl(null); setFile(null); setRotation(0); }}
                    className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-xs transition-colors uppercase tracking-widest"
                  >
                    <RefreshCcw size={14} /> Start New sequence
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
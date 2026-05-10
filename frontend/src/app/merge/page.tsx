"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FilePlus, Download, X, ArrowLeft, RefreshCcw,
  Moon, Sun, Loader2, Sparkles, Activity, FileText
} from 'lucide-react';
import Link from 'next/link';
import { reportArcaneUsage } from "@/utils/analytics";
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
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (dist < 150) {
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

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
};

/* ================= MERGE PAGE COMPONENT ================= */
export default function MergePage() {
  const [dark, setDark] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  /* ================= PREVIEW & CLEANUP ================= */
  useEffect(() => {
    return () => {
      if (mergedUrl) URL.revokeObjectURL(mergedUrl);
    };
  }, [mergedUrl]);

  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(files[0]);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [files]);

  /* ================= HANDLERS ================= */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      setMergedUrl(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setMergedUrl(null);
  };

  const mergePDFs = async () => {
    if (files.length < 2) return alert("Please select at least 2 PDF files.");
    setIsMerging(true);

    try {
      const totalInjectedBytes = files.reduce((acc, file) => acc + file.size, 0);

      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: "application/pdf" });

      // Reporting usage to sovereign ledger
      reportArcaneUsage("Arcane Merge", totalInjectedBytes);

      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
    } catch (error) {
      console.error("Merging failed:", error);
      alert("Sovereign Error: Ensure PDFs are not encrypted.");
    } finally {
      setIsMerging(false);
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
              Arcane <span style={{ color: BRAND.magenta }}>Merge</span>
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

      <div className="relative z-10 max-w-4xl mx-auto pt-40 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? 'bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5' : 'bg-white/80 border-slate-200 shadow-slate-100'}`}
        >

          <header className="text-center mb-10">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>
              PDF <span style={{ color: BRAND.magenta }}>Compiler</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Protocol: High-Fidelity Document Merging • 2026</p>
          </header>

          <AnimatePresence mode="wait">
            {!mergedUrl && !isMerging ? (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {/* DROPZONE */}
                <div className={`group relative border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40 hover:bg-[#CC208E]/5' : 'border-slate-200 hover:border-[#CC208E]/40 hover:bg-slate-50'}`}>
                  <input type="file" accept=".pdf" multiple className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleFileChange} />
                  <div className="relative z-10">
                    <FilePlus style={{ color: BRAND.magenta }} className="mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" size={56} />
                    <p className={`font-black text-xl uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                      {files.length > 0 ? `${files.length} Fragments Injected` : "Inject Document Fragments"}
                    </p>
                    <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">Protocol: Awaiting PDF Stream</p>
                  </div>
                </div>

                {/* FILE LIST */}
                {files.length > 0 && (
                  <div className="grid gap-3">
                    {files.map((file, idx) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className={`flex items-center justify-between p-4 rounded-2xl border ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <FileText size={18} style={{ color: BRAND.magenta }} />
                          <span className="text-xs font-bold truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors"><X size={16} /></button>
                      </motion.div>
                    ))}
                  </div>
                )}

                <LivePreviewCard dark={dark} title="Merge Queue" caption="Input">
                  <div className="space-y-4">
                    <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] md:grid-cols-2 ${dark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <span>{files.length > 0 ? `${files.length} PDF fragments loaded` : "Add PDFs to assemble your queue"}</span>
                      <span className="truncate">{files.length > 0 ? files.map((file) => formatPreviewSize(file.size)).join(" • ") : "Preview follows the first file in queue"}</span>
                    </div>
                    <PdfPreview url={previewUrl} title="Merge input preview" dark={dark} emptyLabel="The first queued PDF appears here as a live preview." />
                  </div>
                </LivePreviewCard>

                <button
                  onClick={mergePDFs}
                  disabled={files.length < 2}
                  style={{ backgroundColor: files.length < 2 ? 'transparent' : BRAND.magenta }}
                  className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic ${files.length < 2 ? 'bg-white/5 border border-white/5 text-slate-600' : 'text-white hover:brightness-110'}`}
                >
                  Compile Documents
                </button>
              </motion.div>
            ) : isMerging ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-6">
                <Activity style={{ color: BRAND.magenta }} className="mx-auto animate-spin" size={56} />
                <div>
                  <p className={`font-black tracking-[0.4em] uppercase text-[10px] ${dark ? 'text-white' : 'text-slate-900'}`}>
                    Compiling Document Stream...
                  </p>
                  <p className="text-slate-500 text-[10px] mt-2 font-bold uppercase">Executing High-Fidelity Sequence</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8">
                <LivePreviewCard dark={dark} title="Merged Document" caption="Output">
                  <PdfPreview url={mergedUrl} title="Merged PDF preview" dark={dark} emptyLabel="Merged PDF preview appears here after compilation." />
                </LivePreviewCard>
                <div className={`p-12 rounded-[3rem] border relative overflow-hidden ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-100'}`}>
                  <Sparkles style={{ color: BRAND.magenta }} className="mx-auto mb-4" size={56} />
                  <h2 className={`text-2xl font-black uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-slate-900'}`}>
                    Stream Synthesized
                  </h2>
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer`} />
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => { if (mergedUrl) { const a = document.createElement('a'); a.href = mergedUrl; a.download = `arcane_merged_${Date.now()}.pdf`; a.click(); } }}
                    className={`w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase italic ${dark ? 'bg-white text-black hover:bg-[#CC208E] hover:text-white' : 'bg-[#050412] text-white hover:bg-[#CC208E]'}`}
                  >
                    <Download size={24} /> Extract Merged PDF
                  </button>
                  <button
                    onClick={() => { setMergedUrl(null); setFiles([]); }}
                    className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-xs transition-colors uppercase tracking-widest"
                  >
                    <RefreshCcw size={14} /> New Sequence
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
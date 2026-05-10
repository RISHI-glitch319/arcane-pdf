"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Scissors, Download, ArrowLeft, RefreshCcw,
  Layers, List, CheckCircle2, Moon, Sun
} from 'lucide-react';
import Link from 'next/link';
import { reportArcaneUsage } from "@/utils/analytics";

/* ================= BRAND ================= */
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

/* ================= BACKGROUND ================= */
const ArchitectureBackground = ({ dark }: { dark: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.y < 0) p.y = canvas.height;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(204,32,142,${dark ? 0.4 : 0.2})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener("resize", init);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
    };
  }, [dark]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

/* ================= MAIN ================= */
export default function SplitPage() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [splitUrls, setSplitUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitMode, setSplitMode] = useState<'individual' | 'range'>('individual');
  const [range, setRange] = useState({ start: 1, end: 1 });
  const [totalPages, setTotalPages] = useState(0);

  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      splitUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrl, splitUrls]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    try {
      const pdf = await PDFDocument.load(await selected.arrayBuffer());
      const pages = pdf.getPageCount();

      setTotalPages(pages);
      setRange({ start: 1, end: pages });
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setSplitUrls([]);
    } catch {
      alert("Invalid PDF");
    }
  };

  /* ================= SPLIT ================= */
  const splitPDF = async () => {
    if (!file) return;

    if (splitMode === 'range') {
      if (range.start < 1 || range.end > totalPages || range.start > range.end) {
        alert(`Invalid range. Document has ${totalPages} pages.`);
        return;
      }
    }

    setIsProcessing(true);

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const urls: string[] = [];

      if (splitMode === 'individual') {
        for (let i = 0; i < totalPages; i++) {
          const newPdf = await PDFDocument.create();
          const [page] = await newPdf.copyPages(pdf, [i]);
          newPdf.addPage(page);

          /** * 🔥 FIX APPLIED HERE (Individual Mode)
           * We save the bytes and explicitly cast the buffer to ArrayBuffer 
           * to satisfy strict BlobPart requirements.
           */
          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          urls.push(URL.createObjectURL(blob));
        }
      } else {
        const newPdf = await PDFDocument.create();
        const indices = Array.from(
          { length: range.end - range.start + 1 },
          (_, i) => range.start - 1 + i
        );

        const pages = await newPdf.copyPages(pdf, indices);
        pages.forEach(p => newPdf.addPage(p));

        /** * 🔥 FIX APPLIED HERE (Range Mode)
         */
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        urls.push(URL.createObjectURL(blob));
      }

      setSplitUrls(urls);
      setPreviewUrl(urls[0]);
      reportArcaneUsage("Arcane Split", file.size);

    } catch (error) {
      console.error(error);
      alert("Split failed");
    }

    setIsProcessing(false);
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setSplitUrls([]);
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
              Arcane <span style={{ color: BRAND.magenta }}>Split</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Back to Hub
            </Link>
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-all shadow-lg ${dark ? `bg-[${BRAND.magenta}] text-white` : "bg-slate-100 text-[#CC208E]"}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {!file ? (
        <div className="flex items-center justify-center p-12 h-screen">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative group w-full max-w-4xl pt-10">
            <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
            <div className={`border-2 border-dashed rounded-[3rem] p-24 text-center transition-all duration-500 ${dark ? 'border-white/10 bg-black/20 hover:border-[#CC208E]/40' : 'border-slate-200 bg-white/50 hover:border-[#CC208E]'}`}>
              <div style={{ backgroundColor: `${BRAND.magenta}20`, color: BRAND.magenta }} className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Upload size={40} />
              </div>
              <h2 className={`text-2xl font-black uppercase tracking-tight ${dark ? 'text-white' : 'text-slate-800'}`}>Inject PDF sequence</h2>
              <p className="text-slate-500 mt-2 tracking-tight uppercase font-bold text-[10px]">Everything happens locally in your browser architecture.</p>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row h-screen pt-[73px] overflow-hidden relative z-10">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className={`h-full rounded-[2.5rem] overflow-hidden border shadow-2xl relative min-h-[500px] ${dark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
              <div style={{ backgroundColor: BRAND.magenta }} className="absolute top-6 left-6 z-10 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                {splitUrls.length > 0 ? "Matrix Result" : "Asset Preview"}
              </div>
              <iframe src={previewUrl!} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>

          <div className={`w-full lg:w-[400px] border-l p-8 overflow-y-auto z-10 backdrop-blur-3xl transition-all ${dark ? "bg-black/40 border-white/5" : "bg-white border-slate-200"}`}>
            <AnimatePresence mode="wait">
              {splitUrls.length === 0 ? (
                <motion.div key="options" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex items-center gap-3 mb-8">
                    <div style={{ backgroundColor: `${BRAND.magenta}20`, color: BRAND.magenta }} className="p-3 rounded-2xl">
                      <Scissors size={20} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Configuration</h2>
                  </div>

                  <div className="space-y-4 mb-8">
                    <button onClick={() => setSplitMode('individual')} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${splitMode === 'individual' ? `border-[${BRAND.magenta}] bg-[${BRAND.magenta}]/5` : dark ? 'border-white/5 hover:border-white/20' : 'border-slate-100 hover:border-slate-200'}`}>
                      <Layers style={{ color: splitMode === 'individual' ? BRAND.magenta : '#64748b' }} />
                      <div className="text-left"><p className="font-bold text-sm">Full Sequence</p><p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Individual shards</p></div>
                    </button>
                    <button onClick={() => setSplitMode('range')} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${splitMode === 'range' ? `border-[${BRAND.magenta}] bg-[${BRAND.magenta}]/5` : dark ? 'border-white/5 hover:border-white/20' : 'border-slate-100 hover:border-slate-200'}`}>
                      <List style={{ color: splitMode === 'range' ? BRAND.magenta : '#64748b' }} />
                      <div className="text-left"><p className="font-bold text-sm">Target Range</p><p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Shard distillation</p></div>
                    </button>
                  </div>

                  {splitMode === 'range' && (
                    <div className={`grid grid-cols-2 gap-4 mb-8 p-6 rounded-3xl border ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Start shard</label>
                        <input type="number" value={range.start || ""} onChange={(e) => setRange({ ...range, start: parseInt(e.target.value) })} className={`w-full border p-4 rounded-2xl font-bold outline-none transition-all ${dark ? 'bg-black/40 border-white/5 focus:border-[#CC208E]' : 'bg-white border-slate-200 focus:border-[#CC208E]'}`} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest">End shard</label>
                        <input type="number" value={range.end || ""} onChange={(e) => setRange({ ...range, end: parseInt(e.target.value) })} className={`w-full border p-4 rounded-2xl font-bold outline-none transition-all ${dark ? 'bg-black/40 border-white/5 focus:border-[#CC208E]' : 'bg-white border-slate-200 focus:border-[#CC208E]'}`} />
                      </div>
                    </div>
                  )}

                  <button onClick={splitPDF} disabled={isProcessing} style={{ backgroundColor: BRAND.magenta }} className="w-full text-white py-6 rounded-[2rem] font-black shadow-2xl hover:brightness-110 transition-all uppercase text-sm tracking-widest">
                    {isProcessing ? "Distilling..." : "Commit Split"}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center gap-3 mb-8">
                    <CheckCircle2 style={{ color: BRAND.magenta }} size={24} />
                    <h2 className="text-xl font-black uppercase tracking-tighter">Sequence Ready</h2>
                  </div>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 mb-8 custom-scrollbar">
                    {splitUrls.map((url, i) => (
                      <div key={i} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="font-black text-[9px] uppercase text-slate-500 tracking-widest">
                          {splitMode === 'individual' ? `Shard ${i + 1}` : 'Distilled Asset'}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => setPreviewUrl(url)} className="p-2 text-slate-500 hover:text-[#CC208E] transition-colors"><Scissors size={14} /></button>
                          <a href={url} download={splitMode === 'individual' ? `shard-${i + 1}.pdf` : 'distilled.pdf'} style={{ color: BRAND.magenta }} className={`px-4 py-2 rounded-xl text-[9px] font-black border border-[#CC208E]/20 hover:bg-[#CC208E] hover:text-white transition-all uppercase tracking-tighter`}>Extract</a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={reset} className="w-full py-5 text-slate-500 font-black text-[10px] uppercase hover:text-[#CC208E] flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-white/10 rounded-3xl transition-colors">
                    <RefreshCcw size={14} /> New Protocol sequence
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(204, 32, 142, 0.2); border-radius: 10px; }
      `}</style>
    </main>
  );
}
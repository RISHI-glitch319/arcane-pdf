"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib-with-encrypt';
import { motion, AnimatePresence } from 'framer-motion';
import { Unlock, ArrowLeft, Eye, EyeOff, FileKey, RefreshCcw, CheckCircle2, Moon, Sun, Info, Sparkles, Activity } from 'lucide-react';
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
      particles.forEach((p, i) => {
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

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (dist < 150) {
            ctx.beginPath();
            const opacity = dark ? (0.15 - dist / 1000) : (0.05 - dist / 2000);
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

/* ================= UNLOCK PAGE COMPONENT ================= */
export default function UnlockPage() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockedUrl, setUnlockedUrl] = useState<string | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);

  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  useEffect(() => {
    if (!file) {
      setInputPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setInputPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    return () => {
      if (unlockedUrl) {
        URL.revokeObjectURL(unlockedUrl);
      }
    };
  }, [unlockedUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setUnlockedUrl(null);
    }
  };

  const unlockPDF = async () => {
    if (!file || !password) return alert("Please select a file and enter its password.");
    setIsUnlocking(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password: password });
      const unlockedPdfBytes = await pdfDoc.save();

      /**
       * 🔥 CRITICAL BUILD FIX:
       * We pass the buffer explicitly and cast it to satisfy the 
       * non-SharedArrayBuffer requirement for BlobPart.
       */
      const blob = new Blob([unlockedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

      reportArcaneUsage("Arcane Unlock", blob.size);

      const url = URL.createObjectURL(blob);
      setUnlockedUrl(url);

      const link = document.createElement('a');
      link.href = url;
      link.download = `unlocked_arcane_${file.name}`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); }, 100);
      alert("Sovereign Protocol Success: PDF Securely Unlocked.");
    } catch (error) {
      console.error(error);
      alert("Invalid password or the file is not encrypted.");
    } finally {
      setIsUnlocking(false);
    }
  }

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
              Arcane <span style={{ color: BRAND.magenta }}>Unlock</span>
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

      <div className="relative z-10 max-w-2xl mx-auto pt-40 p-6 md:p-12">
        <header className="mb-10 text-center">
          <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
            <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
          </div>
          <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>
            Unlock <span style={{ color: BRAND.magenta }}>PDF</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Protocol Decryption • Sovereign Architecture • 2026</p>
        </header>

        <div className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? 'bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5' : 'bg-white/80 border-slate-200 shadow-slate-100'}`}>
          <AnimatePresence mode="wait">
            {!unlockedUrl ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                <div className="relative group">
                  <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                  <div className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-500 ${dark ? 'border-white/10 bg-white/5 group-hover:border-[#CC208E]' : 'border-slate-200 bg-slate-50 group-hover:border-[#CC208E]'}`}>
                    <FileKey style={{ color: BRAND.magenta }} className="mx-auto mb-4" size={32} />
                    <p className={`font-black text-sm uppercase italic tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
                      {file ? file.name : "Inject Locked Protocol"}
                    </p>
                  </div>
                </div>

                <div>
                  <label style={{ color: BRAND.magenta }} className="text-[11px] font-black uppercase block mb-3 tracking-widest px-1">Access Sequence</label>
                  <div className="relative group">
                    <Unlock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${dark ? 'text-slate-500 group-focus-within:text-[#CC208E]' : 'text-slate-400 group-focus-within:text-[#CC208E]'}`} size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full border-2 p-5 pl-14 pr-14 rounded-2xl font-black outline-none transition-all ${dark ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-[#CC208E] placeholder:text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-[#CC208E] placeholder:text-slate-400'}`}
                      placeholder="Enter decryption key..."
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#CC208E] transition">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <LivePreviewCard dark={dark} title="Unlock Source" caption="Input">
                  <div className="space-y-4">
                    <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] md:grid-cols-2 ${dark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <span>{file ? file.name : "No locked PDF selected yet"}</span>
                      <span>{file ? `${formatPreviewSize(file.size)} • ${password ? "key entered" : "awaiting key"}` : "Select a PDF to activate live preview"}</span>
                    </div>
                    <PdfPreview url={inputPreviewUrl} title="Unlock input preview" dark={dark} emptyLabel="Selected PDF preview appears here before decryption." />
                  </div>
                </LivePreviewCard>

                <button
                  onClick={unlockPDF}
                  disabled={isUnlocking}
                  style={{ backgroundColor: isUnlocking ? 'transparent' : BRAND.magenta }}
                  className={`w-full py-6 rounded-2xl font-black shadow-xl transition-all duration-300 flex items-center justify-center gap-3 uppercase text-sm tracking-[0.2em] italic active:scale-[0.98] ${isUnlocking ? 'bg-white/5 border border-white/5 text-slate-500 opacity-20' : 'text-white hover:brightness-110 shadow-[#CC208E]/20'}`}
                >
                  {isUnlocking ? "Decrypting Protocol..." : "Execute Decryption"}
                </button>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <LivePreviewCard dark={dark} title="Unlocked PDF" caption="Output">
                  <PdfPreview url={unlockedUrl} title="Unlocked PDF preview" dark={dark} emptyLabel="Unlocked PDF preview appears here." />
                </LivePreviewCard>
                <div style={{ backgroundColor: `${BRAND.magenta}20`, color: BRAND.magenta }} className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative overflow-hidden">
                  <CheckCircle2 size={40} />
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer`} />
                </div>
                <h2 className={`text-2xl font-black uppercase tracking-tight mb-2 italic ${dark ? 'text-white' : 'text-slate-900'}`}>Sequence Ready</h2>
                <p className="text-slate-500 mb-8 font-medium italic">Sovereign Protocol Unlocked. Distillation Ready.</p>

                <div className="flex flex-col gap-4">
                  <a href={unlockedUrl} download={`arcane_unlocked_${file?.name}`} style={{ backgroundColor: BRAND.magenta }} className="text-white py-6 rounded-2xl font-black shadow-lg hover:brightness-110 transition uppercase text-sm tracking-widest italic">
                    Extract Decrypted PDF
                  </a>
                  <button onClick={() => { setFile(null); setPassword(""); setUnlockedUrl(null); }} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-[#CC208E] mt-4 transition-colors">
                    <RefreshCcw size={14} /> Start New Protocol
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
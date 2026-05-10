"use client";

import { API_BASE } from "@/config/api";
import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Download, FileUp, Activity, Sun, Moon,
  ImageIcon, RefreshCcw, Loader2, ArrowLeft, BrainCircuit, Sparkles
} from "lucide-react";
import Link from "next/link";

/* ================= BRAND CONSTANTS ================= */
const BRAND = { magenta: "#CC208E", purple: "#6713D2" };

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
      particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 1,
        color: Math.random() > 0.5 ? "204, 32, 142" : "103, 19, 210"
      }));
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    init(); draw();
    const mm = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", mm);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", mm);
    };
  }, [dark]);

  return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
};

export default function SignPDF() {
  // --- LOCAL STATE ONLY: Initialized to dark mode by default for each tab ---
  const [dark, setDark] = useState(true);
  const sigCanvas = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [signMode, setSignMode] = useState<'draw' | 'upload'>('draw');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  const [stampPos, setStampPos] = useState({ x: 0.5, y: 0.5 });
  const [stampSize, setStampSize] = useState({ w: 160, h: 80 });

  // --- REFACTORED: Removed localStorage read effect ---

  // --- REFACTORED: Standardized Toggle Logic (No storage writes) ---
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  const onFileInject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setStep(2);
    }
  };

  const confirmSignature = () => {
    if (signMode === 'draw') {
      if (sigCanvas.current.isEmpty()) return;
      setSignatureImage(sigCanvas.current.toDataURL());
    }
    setStep(3);
  };

  // --- CLEANUP PROTOCOL: Ensure Blob URLs are revoked correctly ---
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const handleFinalSign = async () => {
    if (!file || !signatureImage) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("signature_base64", signatureImage);
    formData.append("x_percent", stampPos.x.toString());
    formData.append("y_percent", stampPos.y.toString());
    formData.append("width_px", stampSize.w.toString());
    formData.append("height_px", stampSize.h.toString());

    try {
      const API_URL = API_BASE;
      const res = await fetch(`${API_URL}/sign-pdf`, { method: "POST", body: formData });

      if (!res.ok) throw new Error("Backend Protocol Rejected");

      const blob = await res.blob();
      setResultUrl(window.URL.createObjectURL(blob));
    } catch (err) {
      alert("Neural Protocol Error: Matrix distillation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`min-h-screen relative flex flex-col transition-all duration-700 font-sans overflow-x-hidden ${dark ? "bg-[#050412] text-slate-200" : "bg-slate-50 text-slate-900"}`}>
      <ArchitectureBackground dark={dark} />

      {/* TOP NAVBAR */}
      <nav className={`fixed top-0 w-full h-[70px] z-50 flex items-center justify-between px-8 border-b backdrop-blur-xl transition-all ${dark ? 'border-white/10' : 'border-slate-200 shadow-sm bg-white/80'}`}>
        <Link href="/" className="font-black italic text-xl uppercase tracking-tighter flex items-center gap-2">
          <span style={{ color: BRAND.magenta }}>Arcane</span> <span>Sign</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className={`text-[10px] font-black uppercase opacity-40 hover:opacity-100 flex items-center gap-2 transition-all ${dark ? 'text-white' : 'text-black'}`}>
            <ArrowLeft size={14} /> Back
          </Link>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all ${dark ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-slate-100 border border-slate-200 hover:bg-slate-200'}`}>
            {dark ? <Sun size={18} className="text-[#CC208E]" /> : <Moon size={18} className="text-[#CC208E]" />}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto pt-32 p-6 flex-1 w-full flex flex-col items-center relative z-10">
        <AnimatePresence mode="wait">
          {/* STEP 1: INGESTION */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-2xl">
              <input type="file" accept=".pdf" className="hidden" id="pdf-up" onChange={onFileInject} />
              <label htmlFor="pdf-up" className={`cursor-pointer w-full aspect-video border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-6 transition-all hover:border-[#CC208E]/40 ${dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>
                <div className="p-6 rounded-full bg-[#CC208E]/10">
                  <BrainCircuit size={48} className="text-[#CC208E] animate-pulse" />
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Inject PDF Document</h2>
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Sovereign Signature Protocol</p>
                </div>
              </label>
            </motion.div>
          )}

          {/* STEP 2: SIGNATURE GENERATION */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div className={`p-1 rounded-2xl border transition-all ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex gap-2">
                    <button onClick={() => setSignMode('draw')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${signMode === 'draw' ? 'bg-[#CC208E] text-white shadow-lg' : 'opacity-40'}`}>Draw</button>
                    <button onClick={() => setSignMode('upload')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${signMode === 'upload' ? 'bg-[#CC208E] text-white shadow-lg' : 'opacity-40'}`}>Upload</button>
                  </div>
                </div>
                {signMode === 'draw' ? (
                  <div className="bg-white rounded-[2.5rem] p-4 shadow-2xl overflow-hidden border-8 border-black">
                    <SignatureCanvas ref={sigCanvas} penColor="#000" canvasProps={{ className: "w-full h-64 cursor-crosshair" }} />
                    <button onClick={confirmSignature} style={{ backgroundColor: BRAND.magenta }} className="w-full mt-4 py-5 rounded-2xl text-white font-black uppercase italic tracking-widest hover:brightness-110 shadow-lg shadow-[#CC208E]/30">Confirm Signature</button>
                  </div>
                ) : (
                  <div className={`border-4 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const imgUrl = URL.createObjectURL(f);
                      setSignatureImage(imgUrl);
                      setStep(3);
                    }} className="block w-full text-xs font-mono mb-4" />
                    <button
                      onClick={async () => {
                        const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
                        const file = fileInput?.files?.[0];
                        if (!file) return;
                        setLoading(true);
                        const formData = new FormData();
                        formData.append('files', file);
                        try {
                          const API_URL = API_BASE;
                          const res = await fetch(`${API_URL}/api/image-optimized/remove-bg`, { method: "POST", body: formData });
                          const json = await res.json();
                          if (json.success && json.data.length > 0) {
                            setSignatureImage(API_URL + json.data[0].url);
                            setStep(3);
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="mt-4 px-4 py-2 bg-[#CC208E] w-full text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110"
                    >
                      {loading ? 'Processing...' : 'Remove Background'}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 text-center md:text-left">
                <h3 className="text-4xl font-black italic uppercase tracking-tighter">Draft <span style={{ color: BRAND.magenta }}>Shard</span></h3>
                <p className="text-sm font-medium opacity-50 leading-relaxed">The engine requires a signature vector to proceed with matrix injection. Draw or upload your asset.</p>
                <div className="p-4 rounded-2xl bg-[#CC208E]/5 border border-[#CC208E]/10 flex items-center gap-4">
                  <Activity size={20} className="text-[#CC208E]" />
                  <span className="text-[9px] font-black uppercase tracking-widest italic opacity-60">Status: Awaiting Asset Generation</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: MATRIX ALIGNMENT */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full grid lg:grid-cols-[1fr_350px] gap-12 items-start">
              <div
                ref={containerRef}
                className={`relative aspect-[1/1.414] border-4 rounded-[3rem] overflow-hidden select-none shadow-2xl transition-all ${dark ? 'border-white/10 bg-white' : 'border-slate-300 bg-white'}`}
                style={{ touchAction: 'none' }}
              >
                {previewUrl && <iframe src={`${previewUrl}#toolbar=0&navpanes=0`} className="w-full h-full pointer-events-none opacity-40 grayscale" />}

                <div className="absolute top-6 left-6 px-4 py-1.5 rounded-full bg-[#CC208E] text-[10px] font-black text-white uppercase shadow-lg z-20">Matrix Alignment</div>

                <motion.div
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={containerRef}
                  onDragEnd={(e, info) => {
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const offsetX = info.point.x - rect.left;
                    const offsetY = info.point.y - rect.top;
                    const maxW = rect.width - stampSize.w;
                    const maxH = rect.height - stampSize.h;
                    setStampPos({
                      x: Math.max(0, Math.min(maxW, offsetX)) / rect.width,
                      y: Math.max(0, Math.min(maxH, offsetY)) / rect.height
                    });
                  }}
                  style={{
                    left: `${stampPos.x * 100}%`,
                    top: `${stampPos.y * 100}%`,
                    width: stampSize.w, height: stampSize.h,
                    x: "-50%", y: "-50%", position: "absolute"
                  }}
                  className="border-2 border-[#CC208E] bg-white/40 cursor-move z-50 flex items-center justify-center p-1 shadow-2xl group backdrop-blur-sm"
                >
                  <img src={signatureImage!} alt="sign" className="w-full h-full object-contain pointer-events-none" draggable="false" />
                  <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-[#CC208E]" />
                  <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-[#CC208E]" />
                </motion.div>
              </div>

              <div className="space-y-8 sticky top-32">
                <div className={`p-8 rounded-[2.5rem] border transition-all ${dark ? 'bg-white/5 border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'}`}>
                  <p className="text-[10px] font-black uppercase mb-6 opacity-50 tracking-[0.2em] flex items-center gap-2"><Sparkles size={14} /> Precision Scale</p>
                  <input type="range" min="50" max="400" value={stampSize.w} onChange={(e) => setStampSize({ w: +e.target.value, h: +e.target.value / 2 })} className="w-full accent-[#CC208E] cursor-pointer mb-8" />

                  <button onClick={handleFinalSign} className={`w-full py-6 rounded-2xl font-black text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-[#CC208E] to-[#6713D2] uppercase italic`}>
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : "Distill & Download"}
                  </button>

                  <button onClick={() => setStep(2)} className="w-full mt-4 text-[10px] font-black uppercase opacity-30 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <RefreshCcw size={12} /> Redraft Asset
                  </button>
                </div>

                <div className="p-6 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm italic text-[10px] opacity-30 leading-relaxed">
                  Drag the signature shard to the desired coordinate in the document matrix. Scaling will be preserved during distillation.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FINAL DIALOGUE */}
      <AnimatePresence>
        {resultUrl && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8 max-w-sm">
              <div className="w-24 h-24 rounded-full bg-[#CC208E]/20 mx-auto flex items-center justify-center border border-[#CC208E]/40">
                <CheckCircle size={60} style={{ color: BRAND.magenta }} className="animate-pulse" />
              </div>
              <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">Protocol Distilled</h2>
              <a href={resultUrl} download={`Signed_${file?.name}`} className="block w-full py-6 rounded-full font-black text-white shadow-2xl hover:scale-105 transition-all bg-gradient-to-r from-[#CC208E] to-[#6713D2]">DOWNLOAD ASSET</a>
              <button onClick={() => { setResultUrl(null); setStep(1); }} className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Wipe Memory & Reset</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CC208E; border-radius: 10px; }
        iframe { color-scheme: ${dark ? 'dark' : 'light'}; }
      `}</style>
    </main>
  );
}
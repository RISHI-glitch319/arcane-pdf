"use client";


import { API_BASE } from "@/config/api";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Loader2,
  Moon,
  RefreshCcw,
  Sun,
  Upload,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LivePreviewCard, PdfPreview, formatPreviewSize } from "@/app/_components/live-preview-card";

/* ================= BRAND CONSTANTS ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
  bgDark: "#050412",
  bgSpotlight: "#100654",
};

type InputMode = "url" | "file";

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

    let particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; color: string }> = [];
    let animationFrameId = 0;

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      const particleCount = window.innerWidth < 768 ? 50 : 100;
      for (let i = 0; i < particleCount; i += 1) {
        const colorPool = ["204, 32, 142", "103, 19, 210"];
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 1,
          color: colorPool[Math.floor(Math.random() * colorPool.length)],
        });
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.current = { x: event.clientX, y: event.clientY };
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        const dxMouse = particle.x - mouse.current.x;
        const dyMouse = particle.y - mouse.current.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distMouse < 180 && distMouse > 0) {
          const force = (180 - distMouse) / 180;
          particle.x += (dxMouse / distMouse) * force * 5;
          particle.y += (dyMouse / distMouse) * force * 5;
        }

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color}, ${dark ? "0.4" : "0.15"})`;
        ctx.fill();

        for (let j = index + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dist = Math.sqrt((particle.x - p2.x) ** 2 + (particle.y - p2.y) ** 2);
          if (dist < 130) {
            ctx.beginPath();
            const opacity = dark ? 0.15 - dist / 1000 : 0.05 - dist / 2000;
            ctx.strokeStyle = `rgba(${particle.color}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [dark]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <canvas ref={canvasRef} />
    </div>
  );
};

/* ================= HTML TO PDF PAGE ================= */
export default function HTMLToPDFPage() {
  const [dark, setDark] = useState(true);
  const [mode, setMode] = useState<InputMode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("arcane_capture.pdf");
  const [error, setError] = useState<string | null>(null);
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(null);

  /* ================= PERSISTENCE & CLEANUP ================= */
  useEffect(() => {
    const savedTheme = sessionStorage.getItem("arcane-theme");
    if (savedTheme !== null) setDark(savedTheme === "true");
  }, []);

  useEffect(() => {
    return () => {
      if (resultUrl) window.URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  useEffect(() => {
    if (!htmlFile) {
      setHtmlPreviewUrl(null);
      return;
    }
    const nextUrl = window.URL.createObjectURL(htmlFile);
    setHtmlPreviewUrl(nextUrl);
    return () => window.URL.revokeObjectURL(nextUrl);
  }, [htmlFile]);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    sessionStorage.setItem("arcane-theme", String(newTheme));
  };

  const resetResult = () => {
    if (resultUrl) window.URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setDownloadName("arcane_capture.pdf");
  };

  const switchMode = (nextMode: InputMode) => {
    setMode(nextMode);
    setError(null);
    resetResult();
  };

  const handleConvert = async () => {
    if (mode === "url" && !urlInput.trim()) {
      setError("Enter a URL to continue.");
      return;
    }

    if (mode === "file" && !htmlFile) {
      setError("Upload an HTML file to continue.");
      return;
    }

    let targetUrl = urlInput.trim();
    if (mode === "url" && !/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    setIsConverting(true);
    setProgress(0);
    setError(null);
    resetResult();

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev < 60) return prev + 5;
        if (prev < 90) return prev + 1;
        return prev;
      });
    }, 600);

    try {
            const formData = new FormData();

      if (mode === "url") {
        formData.append("url", targetUrl);
      } else if (htmlFile) {
        formData.append("html_file", htmlFile);
      }

      const response = await fetch(`${API_BASE}/html-to-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Arcane Engine could not generate the PDF.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/i);

      window.clearInterval(interval);
      setProgress(100);
      setResultUrl(objectUrl);
      setDownloadName(filenameMatch?.[1] || "arcane_capture.pdf");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed.";
      setError(message);
      window.clearInterval(interval);
    } finally {
      setIsConverting(false);
    }
  };

  const handleNewSequence = () => {
    resetResult();
    setUrlInput("");
    setHtmlFile(null);
    setError(null);
    setProgress(0);
  };

  const isDisabled = isConverting || (mode === "url" ? !urlInput.trim() : !htmlFile);
  const normalizedUrl = mode === "url" && urlInput.trim()
    ? /^https?:\/\//i.test(urlInput.trim())
      ? urlInput.trim()
      : `https://${urlInput.trim()}`
    : "";

  return (
    <main
      className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"
        }`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ArcaneLogo dark={dark} />
            <span className={`text-xl font-black tracking-tighter uppercase italic transition-colors ${dark ? "text-white" : "text-[#050412]"}`}>
              Arcane <span style={{ color: BRAND.magenta }}>Capture</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? "text-white" : "text-slate-900"}`}>
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
          className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? "bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5" : "bg-white/80 border-slate-200 shadow-slate-100"}`}
        >
          {isConverting && (
            <div className={`absolute top-0 left-0 w-full h-1 overflow-hidden ${dark ? "bg-white/5" : "bg-slate-100"}`}>
              <motion.div
                className="h-full"
                style={{ background: `linear-gradient(to right, ${BRAND.magenta}, ${BRAND.purple})` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          )}

          <header className="text-center mb-10">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? "bg-[#CC208E]/10 border-[#CC208E]/20" : "bg-slate-50 border-slate-200"}`}>
              <Sparkles style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-4xl font-black mb-2 uppercase italic tracking-tighter ${dark ? "text-white" : "text-[#050412]"}`}>
              The <span style={{ color: BRAND.magenta }}>HTML Capturer</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
              Protocol: Convert URL or HTML File to PDF • 2026
            </p>
          </header>

          <AnimatePresence mode="wait">
            {!resultUrl ? (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className={`grid grid-cols-2 gap-3 rounded-[2rem] p-2 ${dark ? "bg-white/5" : "bg-slate-100"}`}>
                  <button
                    type="button"
                    onClick={() => switchMode("url")}
                    className={`rounded-[1.5rem] px-4 py-4 text-sm md:text-base font-black uppercase tracking-wide transition-all flex items-center justify-center gap-3 ${mode === "url" ? "text-white shadow-xl" : dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                      }`}
                    style={mode === "url" ? { background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.purple})` } : undefined}
                  >
                    <LinkIcon size={18} />
                    Enter URL
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("file")}
                    className={`rounded-[1.5rem] px-4 py-4 text-sm md:text-base font-black uppercase tracking-wide transition-all flex items-center justify-center gap-3 ${mode === "file" ? "text-white shadow-xl" : dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                      }`}
                    style={mode === "file" ? { background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.purple})` } : undefined}
                  >
                    <Upload size={18} />
                    Upload HTML
                  </button>
                </div>

                {mode === "url" ? (
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className={`absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none transition-colors ${dark ? "text-[#CC208E]/50 group-focus-within:text-[#CC208E]" : "text-slate-400 group-focus-within:text-[#CC208E]"}`}>
                        <LinkIcon size={24} />
                      </div>
                      <input
                        type="text"
                        placeholder="https://example.com"
                        value={urlInput}
                        onChange={(event) => setUrlInput(event.target.value)}
                        className={`w-full pl-16 pr-6 py-6 border-2 rounded-[2rem] text-xl font-black outline-none transition-all ${dark ? "bg-white/5 text-white border-white/5 focus:border-[#CC208E] focus:bg-white/10 placeholder:text-slate-600" : "bg-slate-50 text-slate-900 border-slate-100 focus:border-[#CC208E] placeholder:text-slate-400"}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className={`block w-full border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer transition-all ${dark ? "border-white/10 bg-white/5 hover:border-[#CC208E]/50 hover:bg-white/10" : "border-slate-200 bg-slate-50 hover:border-[#CC208E]/50 hover:bg-white"}`}>
                      <input
                        type="file"
                        accept=".html,.htm,text/html"
                        className="hidden"
                        onChange={(event) => setHtmlFile(event.target.files?.[0] ?? null)}
                      />
                      <Upload size={28} className="mx-auto mb-4" style={{ color: BRAND.magenta }} />
                      <p className={`text-xl font-black uppercase italic ${dark ? "text-white" : "text-slate-900"}`}>
                        {htmlFile ? htmlFile.name : "Drop or Select HTML File"}
                      </p>
                      <p className={`mt-2 text-xs uppercase tracking-[0.25em] ${dark ? "text-slate-500" : "text-slate-400"}`}>
                        Accepts .html and .htm files
                      </p>
                    </label>
                  </div>
                )}

                <LivePreviewCard
                  dark={dark}
                  title={mode === "url" ? "Source Capture" : "HTML Upload"}
                  caption="Input"
                >
                  <div className="space-y-4">
                    <div className={`rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] ${dark ? "border-white/10 bg-black/20 text-slate-400" : "border-slate-200 bg-white text-slate-500"}`}>
                      {mode === "url"
                        ? normalizedUrl || "Type a URL to render a live website preview."
                        : htmlFile
                          ? `${htmlFile.name} • ${formatPreviewSize(htmlFile.size)}`
                          : "Select an HTML file to render its live preview."}
                    </div>
                    <div className={`overflow-hidden rounded-[1.75rem] border min-h-[260px] ${dark ? "border-white/10 bg-black/20" : "border-slate-200 bg-white"}`}>
                      {mode === "url" && normalizedUrl ? (
                        <iframe src={normalizedUrl} title="HTML live input preview" className="h-[260px] w-full border-none" />
                      ) : mode === "file" && htmlPreviewUrl ? (
                        <iframe src={htmlPreviewUrl} title="HTML file live input preview" className="h-[260px] w-full border-none" />
                      ) : (
                        <div className={`flex min-h-[260px] items-center justify-center px-6 text-center text-xs font-bold uppercase tracking-[0.25em] ${dark ? "text-slate-600" : "text-slate-400"}`}>
                          Preview updates as soon as your source changes.
                        </div>
                      )}
                    </div>
                  </div>
                </LivePreviewCard>

                {error && (
                  <div className={`rounded-[1.5rem] border px-5 py-4 text-sm font-bold ${dark ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConvert}
                  disabled={isDisabled}
                  style={{ backgroundColor: isConverting ? "transparent" : BRAND.magenta }}
                  className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] uppercase italic ${isConverting ? "bg-white/10 text-slate-500 border border-white/5" : "text-white hover:brightness-110"} ${isDisabled && !isConverting ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      PROCESSING HTML {progress}%
                    </>
                  ) : mode === "url" ? (
                    "CAPTURE FROM URL"
                  ) : (
                    "CONVERT HTML FILE"
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8">
                <LivePreviewCard dark={dark} title="Generated PDF" caption="Output">
                  <PdfPreview url={resultUrl} title="Generated HTML to PDF preview" dark={dark} emptyLabel="Generated PDF preview appears here." />
                </LivePreviewCard>
                <div className={`p-10 rounded-[3rem] border relative overflow-hidden ${dark ? "bg-[#CC208E]/10 border-[#CC208E]/20" : "bg-slate-50 border-slate-100"}`}>
                  <CheckCircle2 size={64} style={{ color: BRAND.magenta }} className="mx-auto mb-4" />
                  <p className={`text-2xl font-black uppercase italic ${dark ? "text-white" : "text-slate-900"}`}>
                    PDF Sequence Ready
                  </p>
                  <div style={{ color: BRAND.magenta, backgroundColor: `${BRAND.magenta}20` }} className="mt-2 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.3em] inline-block uppercase">
                    Asset Serialized
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#CC208E]/5 to-transparent skew-x-12 translate-x-full animate-shimmer`} />
                </div>

                <div className="space-y-4">
                  <a
                    href={resultUrl}
                    download={downloadName}
                    className={`block w-full py-6 rounded-[2rem] font-black text-2xl transition-all shadow-2xl uppercase italic ${dark ? "bg-white text-black hover:bg-[#CC208E] hover:text-white" : "bg-[#050412] text-white hover:bg-[#CC208E]"}`}
                  >
                    EXTRACT PDF
                  </a>
                  <button
                    onClick={handleNewSequence}
                    className="text-slate-500 hover:text-[#CC208E] flex items-center gap-2 mx-auto font-black text-xs transition-colors uppercase tracking-widest"
                  >
                    <RefreshCcw size={14} /> Process New Sequence
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <footer className={`mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] transition-all ${dark ? "text-slate-700" : "text-slate-400"}`}>
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
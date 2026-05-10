"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { PDFDocument } from "pdf-lib-with-encrypt";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ShieldCheck,
  Upload,
  ArrowLeft,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Info,
  Sparkles,
  Activity
} from "lucide-react";
import Link from "next/link";
// --- SOVEREIGN TELEMETRY IMPORT ---
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
      const particleCount = window.innerWidth < 768 ? 50 : 100;
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

export default function ProtectPage() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const [protectedUrl, setProtectedUrl] = useState<string | null>(null);

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
      if (protectedUrl) {
        URL.revokeObjectURL(protectedUrl);
      }
    };
  }, [protectedUrl]);

  const strength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length > 6) s++;
    if (password.length > 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const strengthColor = [
    "bg-slate-800",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-[#CC208E]",
  ][strength];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setProtectedUrl(null);
    }
  };

  /**
   * REFACTOR: Ensures we return a standard Uint8Array backed by a 
   * standard ArrayBuffer, never a SharedArrayBuffer.
   */
  const normalizeToUint8Array = (data: any): Uint8Array => {
    let result: Uint8Array;

    if (data instanceof Uint8Array) {
      result = data;
    } else if (data instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && data instanceof SharedArrayBuffer)) {
      result = new Uint8Array(data);
    } else {
      result = new Uint8Array(data);
    }

    // If the underlying buffer is shared, we must clone it to a regular ArrayBuffer
    if (typeof SharedArrayBuffer !== 'undefined' && result.buffer instanceof SharedArrayBuffer) {
      const standardBuffer = new ArrayBuffer(result.byteLength);
      const standardArray = new Uint8Array(standardBuffer);
      standardArray.set(result);
      return standardArray;
    }

    return result;
  };

  const encryptPDF = async () => {
    if (!file || !password) return alert("Please select a file and enter a password.");
    if (password !== confirmPassword) return alert("Passwords do not match!");

    setIsEncrypting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: "highResolution",
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: false,
          documentAssembly: false,
        },
      });

      const encryptedPdfBytes = await pdfDoc.save();

      // Ensure we have a non-shared Uint8Array
      const safeBytes = normalizeToUint8Array(encryptedPdfBytes);

      /**
       * 🔥 CRITICAL FIX FOR TYPESCRIPT & BLOB
       * We extract a fresh ArrayBuffer. By using safeBytes.buffer, 
       * we ensure we pass a standard ArrayBuffer (as handled by normalizeToUint8Array).
       * We cast it to 'ArrayBuffer' to satisfy the 'BlobPart' type requirement.
       */
      const safeBuffer = safeBytes.buffer as ArrayBuffer;

      const blob = new Blob([safeBuffer], { type: "application/pdf" });
      await reportArcaneUsage("Arcane Protect", blob.size);

      const url = URL.createObjectURL(blob);
      setProtectedUrl(url);

      const link = document.createElement("a");
      link.href = url;
      link.download = `protected_arcane_${file.name}`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

      alert("Sovereign Protocol Success: PDF Securely Locked.");
    } catch (error) {
      console.error("Encryption sequence failed:", error);
      alert("Encryption sequence failed. Check console for details.");
    } finally {
      setIsEncrypting(false);
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
              Arcane <span style={{ color: BRAND.magenta }}>Protect</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className={`font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all opacity-60 hover:opacity-100 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowLeft size={14} /> Hub
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

      <div className="relative z-10 max-w-2xl mx-auto pt-32 p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 border transition-all shadow-2xl relative overflow-hidden ${dark ? 'bg-[#0d0d0f]/60 border-[#CC208E]/20 shadow-[#CC208E]/5' : 'bg-white/80 border-slate-200 shadow-slate-100'}`}
        >
          <header className="text-center mb-10">
            <div className={`inline-flex p-3 rounded-2xl border mb-4 ${dark ? 'bg-[#CC208E]/10 border-[#CC208E]/20' : 'bg-slate-50 border-slate-200'}`}>
              <Lock style={{ color: BRAND.magenta }} className="animate-pulse" size={24} />
            </div>
            <h1 className={`text-3xl font-black mb-2 uppercase italic tracking-tighter ${dark ? 'text-white' : 'text-[#050412]'}`}>Sovereign <span style={{ color: BRAND.magenta }}>Encryption</span></h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">AES-256 Local-First Security Engine</p>
          </header>

          <div className="space-y-6">
            <div className={`group relative border-2 border-dashed rounded-[2rem] p-10 text-center transition-all cursor-pointer ${dark ? 'border-white/10 hover:border-[#CC208E]/40' : 'border-slate-200 hover:border-[#CC208E]/40'}`}>
              <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleFileChange} />
              <div className="relative z-10">
                <Upload style={{ color: BRAND.magenta }} className="mx-auto mb-4 group-hover:scale-110 transition-transform" size={40} />
                <p className={`font-black text-sm uppercase italic ${dark ? 'text-white' : 'text-slate-900'}`}>{file ? file.name : "Inject PDF Sequence"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Set Access Key"
                  className={`w-full p-5 rounded-2xl border-2 outline-none transition-all font-bold ${dark ? 'bg-black/40 border-white/5 focus:border-[#CC208E] text-white' : 'bg-slate-50 border-slate-100 focus:border-[#CC208E] text-slate-900'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Access Key"
                  className={`w-full p-5 rounded-2xl border-2 outline-none transition-all font-bold ${dark ? 'bg-black/40 border-white/5 focus:border-[#CC208E] text-white' : 'bg-slate-50 border-slate-100 focus:border-[#CC208E] text-slate-900'}`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>

              <div className="px-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Security Entropy</span>
                  <span style={{ color: strength > 3 ? BRAND.magenta : '#64748b' }} className="text-[8px] font-black uppercase">Level {strength}/5</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-full flex-1 transition-all duration-500 ${i < strength ? strengthColor : 'opacity-10'}`} />
                  ))}
                </div>
              </div>
            </div>

            <LivePreviewCard dark={dark} title="Encryption Source" caption="Input">
              <div className="space-y-4">
                <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] md:grid-cols-2 ${dark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <span>{file ? file.name : "No PDF selected yet"}</span>
                  <span>
                    {file
                      ? `${formatPreviewSize(file.size)} • strength ${strength}/5${confirmPassword ? password === confirmPassword ? " • match" : " • mismatch" : ""}`
                      : "Pick a PDF to activate live preview"}
                  </span>
                </div>
                <PdfPreview url={inputPreviewUrl} title="Protection input preview" dark={dark} emptyLabel="Selected PDF preview appears here before encryption." />
              </div>
            </LivePreviewCard>

            {protectedUrl && (
              <LivePreviewCard dark={dark} title="Protected PDF" caption="Output">
                <PdfPreview url={protectedUrl} title="Protected PDF preview" dark={dark} emptyLabel="Protected PDF preview appears here after encryption." />
              </LivePreviewCard>
            )}

            <button
              onClick={encryptPDF}
              disabled={!file || !password || isEncrypting}
              style={{ backgroundColor: !file || !password ? 'transparent' : BRAND.magenta }}
              className={`w-full py-6 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-[0.98] disabled:opacity-20 uppercase italic ${!file || !password ? 'bg-white/5 border border-white/5 text-slate-600' : 'text-white hover:brightness-110 shadow-[#CC208E]/20'}`}
            >
              {isEncrypting ? "Securing..." : "Commit Encryption"}
            </button>
          </div>
        </motion.div>

        <footer className={`mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] transition-all ${dark ? 'text-slate-700' : 'text-slate-400'}`}>
          Arcane Engine • Secured by Digital Sovereignty • 2026
        </footer>
      </div>
    </main>
  );
}
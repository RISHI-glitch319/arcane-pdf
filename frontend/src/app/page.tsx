"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence
} from "framer-motion";
import Link from "next/link";
import {
  Search,
  Moon,
  Sun,
  Combine,
  Scissors,
  Zap,
  Lock,
  ShieldCheck,
  FileType,
  FileText,
  RotateCcw,
  Layers,
  PenTool,
  Droplets,
  Globe,
  Hash,
  Bug,
  Linkedin,
  MessageSquare,
  Info,
  Send,
  Mail,
  Box,
  Code2,
  Terminal,
  Database,
  Cpu,
  Server,
  ShieldAlert,
  Sparkles,
  Activity,
  ChevronDown,
  LayoutGrid,
  FileJson,
  FileCode,
  Table,
  Presentation,
  Image as ImageIcon,
  FileDigit,
  FileImage,
  ScanText
} from "lucide-react";
import { useMode } from "./context/ModeContext";
import { TopModeToggle } from "./components/TopModeToggle";
import { IMAGE_TOOLS } from "../config/tools";

/* ================= BRAND COLORS ================= */
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

/* ================= DROPDOWN MENU COMPONENT ================= */
const NavDropdown = ({ title, items, dark }: { title: string; items: any[]; dark: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className={`flex items-center gap-1 px-3 py-2 font-black uppercase text-[10px] tracking-widest transition-colors ${dark ? 'text-white hover:text-[#CC208E]' : 'text-slate-900 hover:text-[#CC208E]'}`}>
        {title} <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute top-full left-0 min-w-[240px] p-3 rounded-2xl border shadow-2xl backdrop-blur-3xl z-[100] mt-2
              ${dark ? 'bg-black/90 border-white/10 shadow-black' : 'bg-white/90 border-slate-200 shadow-slate-200'}`}
          >
            <div className="grid gap-1">
              {items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all group/item ${dark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                >
                  <item.icon size={16} style={{ color: BRAND.magenta }} className="group-hover/item:scale-110 transition-transform" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${dark ? 'text-slate-400 group-hover/item:text-white' : 'text-slate-600 group-hover/item:text-slate-900'}`}>
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

/* ================= TECH MARQUEE ================= */
const TechMarquee = ({ dark }: { dark: boolean }) => {
  const techs = ["Next.js", "FastAPI", "Python", "TypeScript", "React", "Framer Motion", "Tailwind CSS", "OCR Engine"];
  return (
    <div className="flex overflow-hidden space-x-12 group py-8 select-none z-10 relative border-y border-white/5">
      <div className="flex space-x-12 animate-loop-scroll group-hover:paused">
        {techs.concat(techs).map((tech, i) => (
          <span key={i} className={`text-[10px] font-black uppercase tracking-[0.4em] transition-colors cursor-default whitespace-nowrap ${dark ? 'text-slate-500 hover:text-[#CC208E]' : 'text-slate-400 hover:text-[#CC208E]'}`}>
            {tech}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ================= ADAPTIVE GLASS CARD ================= */
const AdaptiveCard = ({ children, dark }: { children: React.ReactNode; dark: boolean }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className={`group relative p-8 rounded-[3rem] border-2 transition-all h-full flex flex-col items-start overflow-hidden backdrop-blur-3xl cursor-pointer
        ${dark
          ? "bg-[#0d0d0f]/60 border-white/5 hover:border-[#CC208E]/60 shadow-2xl"
          : "bg-white/80 border-slate-200 hover:border-[#CC208E]/40 shadow-lg hover:shadow-xl"}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[3rem] opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useTransform(
            [mouseX, mouseY],
            ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, rgba(204, 32, 142, ${dark ? 0.15 : 0.08}), transparent 80%)`
          ),
        }}
      />
      {children}
    </motion.div>
  );
};

/* ================= ARCHITECT CAROUSEL ================= */
const ArchitectCarousel = ({ dark }: { dark: boolean }) => {
  const pillars = [
    { title: "Sovereign Security", icon: ShieldAlert, color: "text-red-500" },
    { title: "FastAPI Backend", icon: Server, color: `text-[${BRAND.purple}]` },
    { title: "Local-First OCR", icon: Terminal, color: `text-[${BRAND.magenta}]` },
    { title: "Python Logic", icon: Code2, color: "text-yellow-500" },
    { title: "React Frontend", icon: Box, color: "text-blue-500" }
  ];

  return (
    <div className="flex-1 w-full h-[500px] overflow-hidden relative flex flex-col justify-center">
      <div className="flex space-x-6 animate-carousel-scroll-fast group mb-6">
        {pillars.concat(pillars).map((p, i) => (
          <div key={i} className={`min-w-[250px] p-8 rounded-[3rem] border-2 backdrop-blur-lg flex flex-col items-center justify-center transition-all hover:scale-105 shadow-2xl ${dark ? 'bg-[#0d0d0f] border-white/10' : 'bg-white border-slate-100'}`}>
            <p.icon className={`mb-4 ${p.color}`} size={48} />
            <span className={`font-black uppercase tracking-widest text-[10px] opacity-60 text-center ${dark ? 'text-white' : 'text-slate-900'}`}>{p.title}</span>
          </div>
        ))}
      </div>
      <div className="flex space-x-6 animate-carousel-scroll-slow group -ml-24">
        {pillars.concat(pillars).reverse().map((p, i) => (
          <div key={i} className={`min-w-[250px] p-8 rounded-[3rem] border-2 backdrop-blur-lg flex flex-col items-center justify-center transition-all hover:scale-105 shadow-2xl ${dark ? 'bg-[#0d0d0f] border-white/10' : 'bg-white border-slate-100'}`}>
            <p.icon className={`mb-4 ${p.color}`} size={48} />
            <span className={`font-black uppercase tracking-widest text-[10px] opacity-60 text-center ${dark ? 'text-white' : 'text-slate-900'}`}>{p.title}</span>
          </div>
        ))}
      </div>
      <div className={`absolute inset-y-0 left-0 w-32 z-10 pointer-events-none bg-gradient-to-r ${dark ? 'from-[#050412] to-transparent' : 'from-white to-transparent'}`} />
      <div className={`absolute inset-y-0 right-0 w-32 z-10 pointer-events-none bg-gradient-to-l ${dark ? 'from-[#050412] to-transparent' : 'from-white to-transparent'}`} />
    </div>
  );
};

/* ================= MAIN HOME PAGE ================= */
export default function Home() {
  const { mode: activeMode } = useMode();

  // REFACTOR: Initialize state directly to default. No localStorage retrieval.
  const [dark, setDark] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [randomPitch, setRandomPitch] = useState("");
  const aboutRef = useRef<HTMLElement>(null);

  const pdfCategories = [
    "All",
    "Workflows",
    "Organize PDF",
    "Optimize PDF",
    "Convert PDF",
    "Edit PDF",
    "PDF Security",
    "PDF Intelligence",
  ];

  const imgCategories = [
    "All",
    "Optimize Image",
    "Edit Image",
    "Convert Image",
  ];

  const categories = activeMode === "pdf" ? pdfCategories : imgCategories;

  useEffect(() => {
    // REFACTOR: Purged theme loader from localStorage.
    // Each tab now initializes its own pitch sequence.
    const pitches = [
      "Zero Servers. Total Control. Local-First Intelligence.",
      "Cinematic Speed. Sovereign Security. The Future of PDF Engineering.",
      "High-Performance Document Processing with FastAPI Efficiency.",
      "Built to Outperform. Designed to Protect. The Arcane Standard.",
      "Transforming Static Documents into Dynamic Assets with AI Precision.",
      "Zero-Data Leakage • Local Hardware Acceleration Engine."
    ];
    setRandomPitch(pitches[Math.floor(Math.random() * pitches.length)]);
  }, []);

  // REFACTOR: Standardized toggle function. No side effects. No storage writes.
  const toggleTheme = () => {
    setDark(prev => !prev);
  };

  const scrollToAbout = () => aboutRef.current?.scrollIntoView({ behavior: "smooth" });

  const pdfTools = useMemo(() => [
    { name: "Merge PDF", desc: "Combine multiple PDF documents into a single high-quality file.", icon: Combine, href: "/merge", category: "Organize PDF" },
    { name: "Split PDF", desc: "Easily extract specific pages or split your PDF into separate standalone documents.", icon: Scissors, href: "/split", category: "Organize PDF" },
    { name: "Compress PDF", desc: "Optimize your file size using our Sovereign Engine while maintaining resolution.", icon: Zap, href: "/compress", category: "Optimize PDF" },
    { name: "Protect PDF", desc: "Add robust 256-bit encryption and passwords to secure your sensitive information.", icon: Lock, href: "/protect", category: "PDF Security" },
    { name: "Unlock PDF", desc: "Remove security restrictions and passwords from files you have the right to access.", icon: ShieldCheck, href: "/unlock", category: "PDF Security" },
    { name: "PDF to Word", desc: "Transform PDFs into editable Microsoft Word documents.", icon: FileText, href: "/pdf-to-word", category: "Convert PDF" },
    { name: "PDF to Excel", desc: "Extract data tables directly into XLSX sheets for powerful data analysis.", icon: Table, href: "/pdf-to-excel", category: "Convert PDF" },
    { name: "PDF to PPT", desc: "Convert document pages into polished PowerPoint presentation slides.", icon: Presentation, href: "/pdf-to-ppt", category: "Convert PDF" },
    { name: "PDF to JPG", desc: "Extract every page of your PDF into high-resolution JPG or PNG image files.", icon: ImageIcon, href: "/pdf-to-jpg", category: "Convert PDF" },
    { name: "Word to PDF", desc: "Instant, accurate conversion from Microsoft Word DOCX to professional PDF format.", icon: FileType, href: "/word-to-pdf", category: "Workflows" },
    { name: "Excel to PDF", desc: "Turn complex spreadsheets into easy-to-read, printable PDF documents.", icon: FileType, href: "/excel-to-pdf", category: "Workflows" },
    { name: "PPT to PDF", desc: "Convert your presentation decks into standard PDF files for universal viewing.", icon: FileType, href: "/ppt-to-pdf", category: "Workflows" },
    { name: "JPG to PDF", desc: "Batch convert images into a single, organized PDF document.", icon: FileType, href: "/jpg-to-pdf", category: "Workflows" },
    { name: "HTML to PDF", desc: "Render any live website or HTML code into a perfectly formatted PDF file.", icon: Globe, href: "/html-to-pdf", category: "Create PDF" },
    { name: "Rotate PDF", desc: "Fix orientation issues by rotating pages clockwise or counter-clockwise.", icon: RotateCcw, href: "/rotate-pdf", category: "Organize PDF" },
    { name: "Organize PDF", desc: "Visually reorder, delete, or add pages within your PDF structure.", icon: Layers, href: "/organize-pdf", category: "Organize PDF" },
    { name: "Sign PDF", desc: "Add professional digital signatures directly on the page.", icon: PenTool, href: "/sign-pdf", category: "Edit PDF" },
    { name: "Watermark PDF", desc: "Overlay text or image watermarks with custom transparency.", icon: Droplets, href: "/watermark-pdf", category: "Edit PDF" },
    { name: "Page Numbers", desc: "Add customizable header or footer page numbers.", icon: FileDigit, href: "/numbers", category: "Edit PDF" },
    { name: "Summarize PDF", desc: "Generate concise summaries of your PDF documents.", icon: Sparkles, href: "/summarise", category: "PDF Intelligence" },
    { name: "OCR PDF", desc: "Extract text from scanned PDFs using advanced OCR technology.", icon: FileText, href: "/ocr", category: "PDF Intelligence" },
  ], []);

  const imageTools = useMemo(() => {
    return IMAGE_TOOLS;
  }, []);

  const navSections = useMemo(() => {
    if (activeMode === "pdf") {
      return [
        { title: "Organize", items: pdfTools.filter((t: any) => ["Merge PDF", "Split PDF", "Organize PDF", "Rotate PDF"].includes(t.name)) },
        { title: "Optimize", items: pdfTools.filter((t: any) => ["Compress PDF", "Summarize PDF"].includes(t.name)) },
        { title: "Convert PDF", items: pdfTools.filter((t: any) => ["PDF to Word", "PDF to Excel", "PDF to PPT", "PDF to JPG"].includes(t.name)) },
        { title: "Create PDF", items: pdfTools.filter((t: any) => ["Word to PDF", "Excel to PDF", "PPT to PDF", "JPG to PDF", "HTML to PDF"].includes(t.name)) },
        { title: "Edit & Security", items: pdfTools.filter((t: any) => ["Sign PDF", "Watermark PDF", "Protect PDF", "Unlock PDF", "Page Numbers", "OCR PDF"].includes(t.name)) },
      ];
    } else {
      return [
        { title: "Optimize", items: imageTools.filter((t: any) => ["Compress Image", "Enhance Image", "OCR Image"].includes(t.name)) },
        { title: "Edit Image", items: imageTools.filter((t: any) => ["Resize Image", "Rotate Image", "Watermark Image", "Remove Background"].includes(t.name)) },
        { title: "Convert Image", items: imageTools.filter((t: any) => ["Convert Image"].includes(t.name)) },
      ];
    }
  }, [pdfTools, imageTools, activeMode]);

  const filtered = useMemo(() => {
    const currentTools = activeMode === "pdf" ? pdfTools : imageTools;
    const matchedBySearch = currentTools.filter((t: any) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );

    if (activeCategory === "All") return matchedBySearch;
    return matchedBySearch.filter((t: any) => t.category === activeCategory);
  }, [pdfTools, imageTools, activeMode, search, activeCategory]);

  return (
    <main
      className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden selection:bg-[#CC208E]/30 ${dark ? "bg-[#050412] text-slate-200" : "bg-white text-slate-900"}`}
      style={dark ? { background: `radial-gradient(at top left, ${BRAND.bgSpotlight} 0%, ${BRAND.bgDark} 40%, ${BRAND.bgDark} 100%)` } : {}}
    >
      <ArchitectureBackground dark={dark} />

      {/* HEADER / NAVBAR */}
      <header className={`fixed top-0 w-full flex justify-between items-center px-4 md:px-12 py-3 z-50 backdrop-blur-xl border-b transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-white/70 border-slate-200"}`}>
        <div className="flex items-center gap-4 lg:gap-8 shrink-0">
          <Link href="/" className="flex items-center gap-3 no-underline group">
            <ArcaneLogo dark={dark} />
            <h1 className={`text-lg lg:text-xl font-black italic tracking-tighter uppercase transition-colors hidden lg:block ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Arcane <span style={{ color: BRAND.magenta }}>PDF</span>
            </h1>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navSections.map((section) => (
              <NavDropdown key={section.title} title={section.title} items={section.items} dark={dark} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              placeholder="Search Shards..."
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest w-32 md:w-48 transition-all outline-none ${dark ? `bg-black/40 border-[${BRAND.magenta}]/20 text-white focus:border-[${BRAND.magenta}]/60` : `bg-slate-50 border-slate-200 text-slate-900 focus:border-[${BRAND.magenta}]`}`}
            />
          </div>
          <button onClick={scrollToAbout} className="p-2 opacity-60 hover:opacity-100 transition-opacity" title="The Architect"><Info size={18} /></button>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-all shadow-lg ${dark ? `bg-[${BRAND.magenta}] text-white` : `bg-slate-100 text-[${BRAND.magenta}] shadow-slate-200`}`}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="text-center pt-18 md:pt-28 pb-4 px-6 relative z-10">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <TopModeToggle />
          <h2 className={`text-6xl md:text-8xl font-black tracking-tight leading-[0.9] mb-6 uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>
            The <span style={{ color: BRAND.magenta }}>Sovereign</span> <br />
            {activeMode === "pdf" ? "PDF Protocol" : "IMG Protocol"}
          </h2>
          <p className={`mt-2 text-[10px] font-black tracking-[0.4em] uppercase opacity-60 transition-opacity duration-1000 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            {activeMode === "pdf" ? randomPitch : "Advanced Image Cloning & Conversion Engine"}
          </p>
        </motion.div>
      </section>

      {/* TOOL CATEGORIES */}
      <div className="px-6 md:px-12 pt-8 pb-4">
        <div className={`grid gap-2 ${activeMode === "pdf" ? "grid-cols-4 lg:grid-cols-8" : "grid-cols-2 lg:grid-cols-4"}`}>
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`py-2 px-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${isActive ? "bg-slate-900 text-white" : "bg-white/80 border border-slate-300 text-slate-800 hover:bg-slate-100"}`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* TOOL GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 md:px-12 pt-4 pb-10 max-w-[1600px] mx-auto relative z-10">
        <AnimatePresence>
          {filtered.map((tool: any) => (
            <motion.div
              key={tool.name}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="block"
            >
              <Link href={tool.href} className="block no-underline h-full">
                <AdaptiveCard dark={dark}>
                  <div className="flex items-center gap-3 mb-3">
                    <div style={{ color: BRAND.magenta }}>
                      <tool.icon size={24} />
                    </div>
                    <h3 className={`font-bold text-xl z-10 tracking-tight uppercase italic transition-colors ${dark ? 'text-white' : 'text-slate-900'}`}>{tool.name}</h3>
                  </div>
                  <p className={`text-xs font-medium leading-relaxed z-10 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{tool.desc}</p>
                  <div className="mt-auto pt-6 z-10 flex items-center gap-2 text-[#CC208E]">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Activity size={12} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                      Initialize Tool →
                    </span>
                  </div>
                </AdaptiveCard>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* BUG REPORT */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-[60]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`rounded-[3rem] p-12 md:p-16 border flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden backdrop-blur-3xl shadow-2xl transition-all
            ${dark ? "bg-black/60 border-white/10" : "bg-white border-slate-200 shadow-slate-100"}`}
        >
          <div className="z-10 text-center md:text-left pointer-events-none">
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-black tracking-widest uppercase mb-4" style={{ color: BRAND.magenta }}>
              <Bug size={14} className="animate-pulse" /> Found a Glitch?
            </div>
            <h2 className={`text-3xl md:text-5xl font-black mb-4 tracking-tight leading-none uppercase italic ${dark ? 'text-white' : 'text-[#050412]'}`}>
              Refine the <span style={{ color: BRAND.magenta }}>Arcane</span> Engine
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest max-w-sm text-slate-500">
              Identify a bug or suggest an enchantment. We maintain digital sovereignty.
            </p>
          </div>

          <div className="flex flex-col gap-3 z-[100] relative">
            <a
              href="mailto:arcanepdf@gmail.com"
              className={`group px-12 py-6 rounded-3xl font-black text-lg flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl uppercase italic
                ${dark ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}
            >
              <Mail size={24} />
              REPORT BUG
              <Send size={18} style={{ color: BRAND.magenta }} className="group-hover:translate-x-1 transition-transform" />
            </a>

            <button
              onClick={() => {
                navigator.clipboard.writeText("arcanepdf@gmail.com");
                alert("Email Copied to Clipboard!");
              }}
              className={`text-[10px] font-black uppercase tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 ${dark ? 'text-white' : 'text-black'}`}
            >
              <Layers size={12} /> Or Copy Email: arcanepdf@gmail.com
            </button>
          </div>

          <div
            className="absolute inset-0 pointer-events-none skew-x-12 translate-x-full animate-shimmer"
            style={{
              background: `linear-gradient(to right, transparent, ${BRAND.magenta}10, transparent)`,
              zIndex: 0
            }}
          />
        </motion.div>
      </section>

      {/* ABOUT SECTION */}
      <section ref={aboutRef} className={`px-6 md:px-12 py-32 border-t relative z-10 transition-all ${dark ? "bg-black/40 border-[#CC208E]/10" : "bg-slate-50 border-slate-200"}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-20 items-center">
          <div className="flex-1">
            <h2 className={`text-5xl font-black mb-8 tracking-tighter uppercase italic transition-colors ${dark ? 'text-white' : 'text-[#050412]'}`}>The Architect</h2>
            <p className={`text-xl font-medium leading-relaxed mb-10 transition-colors ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              Arcane PDF was built to solve the fragmentation and privacy flaws of modern document tools. Utilizing high-performance FastAPI, we ensure data stays processed with local hardware acceleration.
            </p>

            <div className={`p-10 rounded-[3rem] border-2 shadow-2xl inline-block min-w-[350px] transition-all
                    ${dark ? `bg-black border-[${BRAND.magenta}]/20 shadow-[${BRAND.magenta}]/10` : "bg-white border-slate-200 shadow-slate-100"}`}>
              <h3 className={`text-3xl font-black mb-1 transition-colors ${dark ? 'text-white' : 'text-slate-900'}`}>RISHIVARUN NEDUNOORI</h3>
              <p style={{ color: BRAND.magenta }} className="font-black uppercase tracking-widest text-[10px] mb-8">Full-Stack and AI&ML Engineer | Creator of Arcane PDF</p>
              <div className="flex gap-4">
                <Link href="https://www.linkedin.com/in/nedunooririshivarun" target="_blank" className={`p-4 rounded-2xl transition-all ${dark ? `bg-white/5 hover:bg-[#CC208E] hover:text-white text-white` : `bg-slate-100 hover:bg-[#CC208E] hover:text-white text-slate-900`}`}>
                  <Linkedin size={24} />
                </Link>
                <Link href="https://wa.me/9959048967" target="_blank" className={`p-4 rounded-2xl transition-all ${dark ? 'bg-white/5 hover:bg-emerald-600 hover:text-black text-white' : 'bg-slate-100 hover:bg-[#CC208E] hover:text-white text-slate-900'}`}>
                  <MessageSquare size={24} />
                </Link>
              </div>
            </div>
          </div>

          <ArchitectCarousel dark={dark} />
        </div>
      </section>

      <footer className={`text-center py-16 border-t opacity-40 text-[10px] font-black uppercase tracking-[0.5em] relative z-10 transition-all ${dark ? 'border-white/5 text-slate-700' : 'border-slate-200 text-slate-500'}`}>
        Arcane Engine • Secured by Digital Sovereignty • © 2026
      </footer>

      <style jsx global>{`
        @keyframes carousel-scroll-fast {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes carousel-scroll-slow {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(150%) skewX(-12deg); }
        }
        @keyframes loop-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .animate-loop-scroll {
          animation: loop-scroll 30s linear infinite;
        }
        .animate-carousel-scroll-fast {
          animation: carousel-scroll-fast 20s linear infinite;
        }
        .animate-carousel-scroll-slow {
          animation: carousel-scroll-slow 25s linear infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s infinite linear;
        }
        .paused {
            animation-play-state: paused;
        }
      `}</style>
    </main>
  );
}
"use client";
import { API_BASE } from "@/config/api";
// "use client";
// import React, { useState, useEffect, useMemo, useRef } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { 
//   BarChart3, Activity, Zap, Database, ArrowLeft, RefreshCcw, 
//   Cpu, Globe, Server, Moon, Sun, PieChart as PieIcon, TrendingUp,
//   Hash as HashIcon, LayoutGrid
// } from "lucide-react";
// import Link from "next/link";
// import axios from "axios";
// import { 
//   BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
//   PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
//   Radar, RadarChart, PolarGrid, PolarAngleAxis
// } from "recharts";

// const BRAND = { magenta: "#CC208E", purple: "#6713D2", bgDark: "#050412" };

// const TIMEZONES = [
//   { label: "UTC", value: "UTC" },
//   { label: "IST (India)", value: "Asia/Kolkata" },
//   { label: "EST (US)", value: "America/New_York" },
//   { label: "GMT", value: "Europe/London" },
// ];

// /* ================= WORLD CLOCK COMPONENT ================= */
// const WorldClock = ({ dark }: { dark: boolean }) => {
//   const [times, setTimes] = useState<Record<string, string>>({});

//   useEffect(() => {
//     const timer = setInterval(() => {
//       const now = new Date();
//       const newTimes: Record<string, string> = {};
//       TIMEZONES.forEach((tz) => {
//         newTimes[tz.label] = now.toLocaleTimeString("en-GB", {
//           hour: "2-digit",
//           minute: "2-digit",
//           second: "2-digit",
//           timeZone: tz.value,
//           hour12: false,
//         });
//       });
//       setTimes(newTimes);
//     }, 1000);
//     return () => clearInterval(timer);
//   }, []);

//   return (
//     <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
//       {TIMEZONES.map((tz) => (
//         <div key={tz.label} className={`flex flex-col items-start px-3 py-1 rounded-lg border min-w-[80px] ${dark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
//           <span className="text-[7px] font-black uppercase tracking-tighter opacity-50">{tz.label}</span>
//           <span className={`text-[10px] font-mono font-bold ${dark ? 'text-[#CC208E]' : 'text-slate-900'}`}>
//             {times[tz.label] || "00:00:00"}
//           </span>
//         </div>
//       ))}
//     </div>
//   );
// };

// /* ================= MAGNETIC CINEMATIC ENGINE (BACKGROUND) ================= */
// const ArchitectureBackground = ({ dark }: { dark: boolean }) => {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const mouse = useRef({ x: -1000, y: -1000 });

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     let particles: any[] = [];
//     let animationFrameId: number;

//     const init = () => {
//       canvas.width = window.innerWidth;
//       canvas.height = window.innerHeight;
//       particles = [];
//       const particleCount = window.innerWidth < 768 ? 40 : 80;
//       for (let i = 0; i < particleCount; i++) {
//         particles.push({
//           x: Math.random() * canvas.width,
//           y: Math.random() * canvas.height,
//           vx: (Math.random() - 0.5) * 0.4,
//           vy: (Math.random() - 0.5) * 0.4,
//           radius: Math.random() * 1.5 + 1,
//           color: Math.random() > 0.5 ? "204, 32, 142" : "103, 19, 210"
//         });
//       }
//     };

//     const handleMouseMove = (e: MouseEvent) => {
//       mouse.current = { x: e.clientX, y: e.clientY };
//     };

//     const draw = () => {
//       ctx.clearRect(0, 0, canvas.width, canvas.height);
//       particles.forEach((p, i) => {
//         p.x += p.vx; p.y += p.vy;
//         const dxMouse = p.x - mouse.current.x;
//         const dyMouse = p.y - mouse.current.y;
//         const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
//         if (distMouse < 180) {
//           const force = (180 - distMouse) / 180;
//           p.x += (dxMouse / distMouse) * force * 5;
//           p.y += (dyMouse / distMouse) * force * 5;
//         }
//         if (p.x < 0) p.x = canvas.width;
//         if (p.x > canvas.width) p.x = 0;
//         if (p.y < 0) p.y = canvas.height;
//         if (p.y > canvas.height) p.y = 0;

//         ctx.beginPath();
//         ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
//         ctx.fillStyle = `rgba(${p.color}, ${dark ? "0.4" : "0.15"})`;
//         ctx.fill();

//         for (let j = i + 1; j < particles.length; j++) {
//           const p2 = particles[j];
//           const dist = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
//           if (dist < 150) {
//             ctx.beginPath();
//             const opacity = dark ? (0.15 - dist / 1000) : (0.05 - dist / 2000);
//             ctx.strokeStyle = `rgba(${p.color}, ${opacity})`;
//             ctx.lineWidth = 0.6;
//             ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
//           }
//         }
//       });
//       animationFrameId = requestAnimationFrame(draw);
//     };

//     init(); draw();
//     window.addEventListener("resize", init);
//     window.addEventListener("mousemove", handleMouseMove);
//     return () => { 
//       cancelAnimationFrame(animationFrameId);
//       window.removeEventListener("resize", init);
//       window.removeEventListener("mousemove", handleMouseMove);
//     };
//   }, [dark]);

//   return <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"><canvas ref={canvasRef} /></div>;
// };

// export default function AnalyticsDashboard() {
//   const [stats, setStats] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [dark, setDark] = useState(true);

//   
//   useEffect(() => {
//     const savedTheme = localStorage.getItem("arcane-theme");
//     if (savedTheme !== null) setDark(savedTheme === "true");
//     fetchStats();
//   }, []);

//   const toggleTheme = () => {
//     const newTheme = !dark;
//     setDark(newTheme);
//     localStorage.setItem("arcane-theme", String(newTheme));
//   };

//   const fetchStats = async () => {
//     setLoading(true);
//     try {
//       const res = await axios.get(`${API_BASE}/engine/stats`);
//       setStats(res.data);
//     } catch (err) { console.error("Telemetry Link Severed"); }
//     finally { setTimeout(() => setLoading(false), 800); }
//   };

//   const chartData = useMemo(() => {
//     if (!stats?.tool_distribution) return [];
//     return Object.entries(stats.tool_distribution).map(([name, value]) => ({
//       name, value: value as number
//     }));
//   }, [stats]);

//   const radarData = useMemo(() => [
//     { subject: 'Speed', A: 120, B: 110, fullMark: 150 },
//     { subject: 'Security', A: 98, B: 130, fullMark: 150 },
//     { subject: 'Data Mass', A: 86, B: 130, fullMark: 150 },
//     { subject: 'Reliability', A: 99, B: 100, fullMark: 150 },
//     { subject: 'Entropy', A: 85, B: 90, fullMark: 150 },
//   ], []);

//   const scatterData = useMemo(() => {
//     return stats?.recent_activity?.map((log: any, i: number) => ({
//       x: i, y: log.size_mb, z: 10, name: log.tool
//     })) || [];
//   }, [stats]);

//   const COLORS = ["#CC208E", "#6713D2", "#00C49F", "#FFBB28", "#FF8042", "#0088FE"];

//   return (
//     <main className={`min-h-screen transition-colors duration-700 p-6 lg:p-16 relative overflow-x-hidden ${dark ? "bg-[#050412] text-slate-200" : "bg-slate-50 text-slate-900"}`}>
//       <ArchitectureBackground dark={dark} />

//       <div className="max-w-7xl mx-auto relative z-10">
//         <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
//           <div className="flex-1">
//             <Link href="/" className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] hover:opacity-100 transition-all mb-4 ${dark ? "text-[#CC208E]" : "text-slate-500"}`}>
//               <ArrowLeft size={14}/> Back to Architecture
//             </Link>
//             <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none mb-4">
//               Engine <span style={{ color: BRAND.magenta }}>Telemetry</span>
//             </h1>
//             <WorldClock dark={dark} />
//           </div>

//           <div className="flex flex-wrap items-center gap-4">
//             <button onClick={toggleTheme} className={`p-5 rounded-full border transition-all ${dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900 shadow-xl"}`}>
//               {dark ? <Sun size={20} /> : <Moon size={20} />}
//             </button>
//             <button onClick={fetchStats} className={`group p-5 rounded-[2rem] border transition-all flex items-center gap-4 ${dark ? "bg-white/5 border-white/10 hover:bg-[#CC208E]/20" : "bg-white border-slate-200 hover:bg-slate-50 shadow-xl"}`}>
//               <span className="text-[10px] font-black uppercase tracking-widest px-2">Sync Matrix</span>
//               <RefreshCcw size={20} className={`${loading ? "animate-spin" : ""}`} />
//             </button>
//           </div>
//         </header>

//         {/* TOP METRICS */}
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
//           {[
//             { label: "Total Operations", val: stats?.total_operations || 0, icon: <HashIcon/>, color: BRAND.magenta },
//             { label: "Data Mass (MB)", val: stats?.total_data_distilled_mb || 0, icon: <Database/>, color: BRAND.purple },
//             { label: "Active Shards", val: chartData.length, icon: <LayoutGrid/>, color: "#00C49F" },
//             { label: "Health State", val: "Optimal", icon: <Activity/>, color: "#10b981" }
//           ].map((shard) => (
//             <div key={shard.label} className={`p-8 rounded-[2.5rem] border backdrop-blur-3xl transition-all ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-lg"}`}>
//               <div style={{ color: shard.color }} className="mb-4">{shard.icon}</div>
//               <h3 className="text-4xl font-black italic tracking-tighter mb-1">{shard.val}</h3>
//               <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">{shard.label}</p>
//             </div>
//           ))}
//         </div>

//         {/* RANKING & HISTORY */}
//         <div className="grid lg:grid-cols-5 gap-8 mb-8">
//             <section className={`lg:col-span-3 p-10 rounded-[3rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//                 <h2 className="text-xs font-black uppercase italic tracking-widest mb-8 flex items-center gap-3 text-slate-500"><TrendingUp size={16}/> Dominance Rank</h2>
//                 <div className="space-y-5">
//                     {[...chartData].sort((a,b) => b.value - a.value).map((item, idx) => (
//                         <div key={item.name} className="flex items-center gap-6">
//                             <span className="text-xl font-black italic opacity-20">0{idx + 1}</span>
//                             <div className="flex-1">
//                                 <div className="flex justify-between mb-2">
//                                     <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
//                                     <span className="text-[10px] font-black uppercase" style={{ color: BRAND.magenta }}>{item.value} Ops</span>
//                                 </div>
//                                 <div className="h-1.5 w-full bg-slate-800/10 rounded-full overflow-hidden">
//                                     <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / (stats?.total_operations || 1)) * 100}%` }} className="h-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
//                                 </div>
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//             </section>

//             <section className={`lg:col-span-2 p-10 rounded-[3rem] border ${dark ? "bg-black/40 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//                 <h2 className="text-xs font-black uppercase italic tracking-widest mb-8 flex items-center gap-3"><Activity style={{ color: BRAND.magenta }} size={16}/> Neural History</h2>
//                 <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
//                     {stats?.recent_activity?.map((log: any, i: number) => (
//                         <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${dark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
//                             <div>
//                                 <p className="text-[9px] font-black uppercase tracking-widest">{log.tool}</p>
//                                 <p className="text-[8px] opacity-40">
//                                   {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
//                                 </p>
//                             </div>
//                             <span className="text-[10px] font-black italic" style={{ color: BRAND.magenta }}>{log.size_mb}MB</span>
//                         </div>
//                     ))}
//                 </div>
//             </section>
//         </div>

//         {/* 4. RADAR & 2. PIE CHARTS */}
//         <div className="grid lg:grid-cols-2 gap-8 mb-8">
//           <section className={`p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//             <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><Cpu style={{ color: BRAND.magenta }}/> System Efficiency Radar</h2>
//             <div className="h-[350px] w-full">
//               <ResponsiveContainer width="100%" height="100%">
//                 <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
//                   <PolarGrid stroke={dark ? "#1e293b" : "#e2e8f0"} />
//                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
//                   <Radar name="Engine A" dataKey="A" stroke={BRAND.magenta} fill={BRAND.magenta} fillOpacity={0.6} />
//                   <Tooltip />
//                 </RadarChart>
//               </ResponsiveContainer>
//             </div>
//           </section>

//           <section className={`p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//             <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><PieIcon style={{ color: BRAND.magenta }}/> Shard Market Share</h2>
//             <div className="h-[350px] w-full">
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
//                     {chartData.map((entry, index) => (
//                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Pie>
//                   <Tooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
//                   <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </section>
//         </div>

//         {/* 3. SCATTER & BAR CHARTS */}
//         <div className="grid lg:grid-cols-2 gap-8">
//            <section className={`p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//             <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><Zap style={{ color: BRAND.magenta }}/> Neural Density Analysis</h2>
//             <div className="h-[300px] w-full">
//                 <ResponsiveContainer width="100%" height="100%">
//                     <ScatterChart>
//                         <XAxis type="number" dataKey="x" hide />
//                         <YAxis type="number" dataKey="y" name="Size" unit="MB" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
//                         <ZAxis type="number" range={[100, 400]} />
//                         <Tooltip cursor={{ strokeDasharray: '3 3' }} />
//                         <Scatter name="Usage" data={scatterData}>
//                             {scatterData.map((entry: any, index: number) => (
//                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                             ))}
//                         </Scatter>
//                     </ScatterChart>
//                 </ResponsiveContainer>
//             </div>
//           </section>

//           <section className={`p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
//             <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><BarChart3 style={{ color: BRAND.magenta }}/> Volume Metrics</h2>
//             <div className="h-[300px] w-full">
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart data={chartData}>
//                   <XAxis dataKey="name" hide />
//                   <YAxis hide />
//                   <Tooltip contentStyle={{ backgroundColor: dark ? "#050412" : "#fff", borderRadius: "15px", border: "none" }} />
//                   <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={40}>
//                     {chartData.map((entry, index) => (
//                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Bar>
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>
//           </section>
//         </div>
//       </div>

//       <style jsx global>{`
//         .custom-scrollbar::-webkit-scrollbar { width: 4px; }
//         .custom-scrollbar::-webkit-scrollbar-thumb { background: #CC208E; border-radius: 10px; }
//         .no-scrollbar::-webkit-scrollbar { display: none; }
//         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
//       `}</style>
//     </main>
//   );
// }
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Activity, Zap, Database, ArrowLeft, RefreshCcw,
  Cpu, Moon, Sun, PieChart as PieIcon, TrendingUp,
  Hash as HashIcon, LayoutGrid
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis
} from "recharts";

const BRAND = { magenta: "#CC208E", purple: "#6713D2", bgDark: "#050412" };

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "IST (India)", value: "Asia/Kolkata" },
  { label: "EST (US)", value: "America/New_York" },
  { label: "GMT", value: "Europe/London" },
];

/* ================= WORLD CLOCK COMPONENT ================= */
const WorldClock = ({ dark }: { dark: boolean }) => {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const newTimes: Record<string, string> = {};
      TIMEZONES.forEach((tz) => {
        newTimes[tz.label] = now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: tz.value,
          hour12: false,
        });
      });
      setTimes(newTimes);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
      {TIMEZONES.map((tz) => (
        <div key={tz.label} className={`flex flex-col items-start px-3 py-1 rounded-lg border min-w-[80px] ${dark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
          <span className="text-[7px] font-black uppercase tracking-tighter opacity-50">{tz.label}</span>
          <span className={`text-[10px] font-mono font-bold ${dark ? 'text-[#CC208E]' : 'text-slate-900'}`}>
            {times[tz.label] || "00:00:00"}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ================= MAGNETIC CINEMATIC ENGINE BACKGROUND ================= */
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
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 1,
          color: Math.random() > 0.5 ? "204, 32, 142" : "103, 19, 210"
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

/* ================= MAIN DASHBOARD ================= */
export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);

  
  useEffect(() => {
    const savedTheme = sessionStorage.getItem("arcane-theme");
    if (savedTheme !== null) setDark(savedTheme === "true");
    fetchStats();
    setChartsReady(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    sessionStorage.setItem("arcane-theme", String(newTheme));
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/engine/stats`);
      setStats(res.data);
    } catch (err) { console.error("Telemetry Link Severed"); }
    finally { setTimeout(() => setLoading(false), 800); }
  };

  const chartData = useMemo(() => {
    if (!stats?.tool_distribution) return [];
    return Object.entries(stats.tool_distribution).map(([name, value]) => ({
      name, value: value as number
    }));
  }, [stats]);

  const radarData = useMemo(() => [
    { subject: 'Speed', A: 120, fullMark: 150 },
    { subject: 'Security', A: 98, fullMark: 150 },
    { subject: 'Data Mass', A: 86, fullMark: 150 },
    { subject: 'Reliability', A: 99, fullMark: 150 },
    { subject: 'Entropy', A: 85, fullMark: 150 },
  ], []);

  const scatterData = useMemo(() => {
    return stats?.recent_activity?.map((log: any, i: number) => ({
      x: i, y: log.size_mb, z: 10, name: log.tool
    })) || [];
  }, [stats]);

  const COLORS = ["#CC208E", "#6713D2", "#00C49F", "#FFBB28", "#FF8042", "#0088FE"];

  return (
    <main className={`min-h-screen transition-colors duration-700 p-6 lg:p-16 relative overflow-x-hidden ${dark ? "bg-[#050412] text-slate-200" : "bg-slate-50 text-slate-900"}`}>
      <ArchitectureBackground dark={dark} />

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex-1">
            <Link href="/" className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] hover:opacity-100 transition-all mb-4 ${dark ? "text-[#CC208E]" : "text-slate-500"}`}>
              <ArrowLeft size={14} /> Back to Architecture
            </Link>
            <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none mb-4">
              Engine <span style={{ color: BRAND.magenta }}>Telemetry</span>
            </h1>
            <WorldClock dark={dark} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button onClick={toggleTheme} className={`p-5 rounded-full border transition-all ${dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900 shadow-xl"}`}>
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={fetchStats} className={`group p-5 rounded-[2rem] border transition-all flex items-center gap-4 ${dark ? "bg-white/5 border-white/10 hover:bg-[#CC208E]/20" : "bg-white border-slate-200 hover:bg-slate-50 shadow-xl"}`}>
              <span className="text-[10px] font-black uppercase tracking-widest px-2">Sync Matrix</span>
              <RefreshCcw size={20} className={`${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* TOP METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: "Total Operations", val: stats?.total_operations || 0, icon: <HashIcon />, color: BRAND.magenta },
            { label: "Data Mass (MB)", val: stats?.total_data_distilled_mb || 0, icon: <Database />, color: BRAND.purple },
            { label: "Active Shards", val: chartData.length, icon: <LayoutGrid />, color: "#00C49F" },
            { label: "Health State", val: "Optimal", icon: <Activity />, color: "#10b981" }
          ].map((shard) => (
            <div key={shard.label} className={`p-8 rounded-[2.5rem] border backdrop-blur-3xl transition-all ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-lg"}`}>
              <div style={{ color: shard.color }} className="mb-4">{shard.icon}</div>
              <h3 className="text-4xl font-black italic tracking-tighter mb-1">{shard.val}</h3>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">{shard.label}</p>
            </div>
          ))}
        </div>

        {/* RANKING & HISTORY */}
        <div className="grid lg:grid-cols-5 gap-8 mb-8">
          <section className={`lg:col-span-3 min-w-0 p-10 rounded-[3rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-8 flex items-center gap-3 text-slate-500"><TrendingUp size={16} /> Dominance Rank</h2>
            <div className="space-y-5">
              {[...chartData].sort((a, b) => b.value - a.value).map((item, idx) => (
                <div key={item.name} className="flex items-center gap-6">
                  <span className="text-xl font-black italic opacity-20">0{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
                      <span className="text-[10px] font-black uppercase" style={{ color: BRAND.magenta }}>{item.value} Ops</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / (stats?.total_operations || 1)) * 100}%` }} className="h-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`lg:col-span-2 min-w-0 p-10 rounded-[3rem] border ${dark ? "bg-black/40 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-8 flex items-center gap-3"><Activity style={{ color: BRAND.magenta }} size={16} /> Neural History</h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
              {stats?.recent_activity?.map((log: any, i: number) => (
                <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${dark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest">{log.tool}</p>
                    <p className="text-[8px] opacity-40">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </p>
                  </div>
                  <span className="text-[10px] font-black italic" style={{ color: BRAND.magenta }}>{log.size_mb}MB</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RADAR & PIE CHARTS */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <section className={`min-w-0 p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><Cpu style={{ color: BRAND.magenta }} /> System Efficiency Radar</h2>
            <div className="h-[350px] w-full">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke={dark ? "#1e293b" : "#e2e8f0"} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                    <Radar name="Engine A" dataKey="A" stroke={BRAND.magenta} fill={BRAND.magenta} fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className={`min-w-0 p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><PieIcon style={{ color: BRAND.magenta }} /> Shard Market Share</h2>
            <div className="h-[350px] w-full">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '15px', border: 'none' }} />
                    <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        {/* SCATTER & BAR CHARTS */}
        <div className="grid lg:grid-cols-2 gap-8">
          <section className={`min-w-0 p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><Zap style={{ color: BRAND.magenta }} /> Neural Density Analysis</h2>
            <div className="h-[300px] w-full">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <XAxis type="number" dataKey="x" hide />
                    <YAxis type="number" dataKey="y" name="Size" unit="MB" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                    <ZAxis type="number" range={[100, 400]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Usage" data={scatterData}>
                      {scatterData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className={`min-w-0 p-10 rounded-[3.5rem] border ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
            <h2 className="text-xs font-black uppercase italic tracking-widest mb-10 flex items-center gap-3"><BarChart3 style={{ color: BRAND.magenta }} /> Volume Metrics</h2>
            <div className="h-[300px] w-full">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: dark ? "#050412" : "#fff", borderRadius: "15px", border: "none" }} />
                    <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CC208E; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

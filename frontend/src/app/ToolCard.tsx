// "use client";

// import React from "react";
// import { motion } from "framer-motion";
// import { Activity } from "lucide-react";

// interface ToolCardProps {
//   title: string;
//   description: string;
//   onClick: () => void;
//   icon: React.ComponentType<{ size?: number; className?: string }>;
//   dark: boolean;
// }

// /* ================= BRAND CONSTANTS ================= */
// const BRAND = {
//   magenta: "#CC208E",
//   purple: "#6713D2",
// };

// /**
//  * TOOL CARD: SOVEREIGN-SAFE VERSION
//  * * Performance Note: This component is purely presentational. 
//  * It contains zero localStorage/sessionStorage calls, ensuring
//  * that UI state changes in one tab do not propagate to others.
//  */
// export const ToolCard: React.FC<ToolCardProps> = ({
//   title,
//   description,
//   onClick,
//   icon: Icon,
//   dark
// }) => {
//   return (
//     <motion.div
//       whileHover={{ scale: 1.02 }}
//       whileTap={{ scale: 0.98 }}
//       onClick={onClick}
//       className={`group relative p-8 rounded-[3rem] border-2 transition-all h-full flex flex-col items-start overflow-hidden backdrop-blur-3xl cursor-pointer
//         ${dark
//           ? "bg-[#0d0d0f]/60 border-white/5 hover:border-[#CC208E]/60 shadow-2xl"
//           : "bg-white/80 border-slate-200 hover:border-[#CC208E]/40 shadow-lg hover:shadow-xl"}`}
//     >
//       {/* BACKGROUND INTERACTION LAYER */}
//       <div
//         className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
//         style={{
//           background: dark
//             ? `radial-gradient(circle at center, ${BRAND.magenta}10 0%, transparent 70%)`
//             : `radial-gradient(circle at center, ${BRAND.magenta}05 0%, transparent 70%)`
//         }}
//       />

//       {/* ICON & TITLE SECTION */}
//       <div className="flex items-center gap-3 mb-3 relative z-10">
//         <div style={{ color: BRAND.magenta }}>
//           <Icon size={24} />
//         </div>
//         <h3 className={`font-bold text-xl tracking-tight uppercase italic transition-colors ${dark ? 'text-white' : 'text-slate-900'}`}>
//           {title}
//         </h3>
//       </div>

//       {/* DESCRIPTION SECTION */}
//       <p className={`text-xs font-medium leading-relaxed relative z-10 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
//         {description}
//       </p>

//       {/* FOOTER ACTION INDICATOR */}
//       <div className="mt-auto pt-6 relative z-10 flex items-center gap-2">
//         <div
//           style={{ color: BRAND.magenta }}
//           className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
//         >
//           <Activity size={12} className="animate-pulse" />
//         </div>
//         <span
//           className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300"
//           style={{ color: BRAND.magenta }}
//         >
//           Initialize Tool →
//         </span>
//       </div>
//     </motion.div>
//   );
// };
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

/* ================= TYPES ================= */
interface ToolCardProps {
  title: string;
  description: string;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  dark: boolean;
  selected?: boolean;
}

/* ================= BRAND ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
};

/**
 * TOOL CARD COMPONENT
 * - Fully interactive
 * - Selection-aware
 * - Smooth animations
 * - Dark/Light compatible
 * - Keyboard accessible (Enter/Space to activate)
 */
export const ToolCard: React.FC<ToolCardProps> = ({
  title,
  description,
  onClick,
  icon: Icon,
  dark,
  selected = false,
}) => {
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        group relative p-8 rounded-[3rem] border-2 transition-all duration-300 
        h-full flex flex-col items-start overflow-hidden backdrop-blur-3xl cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-[#CC208E]/50 focus:ring-offset-2 focus:ring-offset-transparent
        ${dark
          ? `bg-[#0d0d0f]/60 shadow-2xl ${selected
            ? "border-[#CC208E] ring-2 ring-[#CC208E]/40 brightness-110"
            : "border-white/5 hover:border-[#CC208E]/60"
          }`
          : `bg-white/80 shadow-lg hover:shadow-xl ${selected
            ? "border-[#CC208E] ring-2 ring-[#CC208E]/20 brightness-105"
            : "border-slate-200 hover:border-[#CC208E]/40"
          }`
        }
      `}
    >
      {/* Background Glow Effect */}
      <div
        className={`
          absolute inset-0 pointer-events-none transition-opacity duration-500 rounded-[3rem]
          ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
        style={{
          background: dark
            ? `radial-gradient(circle at center, ${BRAND.magenta}20 0%, transparent 70%)`
            : `radial-gradient(circle at center, ${BRAND.magenta}10 0%, transparent 70%)`,
        }}
      />

      {/* Selection Indicator Badge */}
      {selected && (
        <div
          className="absolute top-4 right-4 w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: BRAND.magenta }}
        />
      )}

      {/* ICON + TITLE */}
      <div className="flex items-center gap-3 mb-3 relative z-10">
        <div
          className="p-2 rounded-xl transition-colors"
          style={{
            color: BRAND.magenta,
            backgroundColor: selected ? `${BRAND.magenta}15` : "transparent",
          }}
        >
          <Icon size={26} />
        </div>
        <h3
          className={`font-bold text-xl tracking-tight uppercase italic transition-colors ${dark ? "text-white" : "text-slate-900"
            }`}
        >
          {title}
        </h3>
      </div>

      {/* DESCRIPTION */}
      <p
        className={`text-xs font-medium leading-relaxed relative z-10 ${dark ? "text-slate-400" : "text-slate-600"
          }`}
      >
        {description}
      </p>

      {/* FOOTER WITH ACTIVITY INDICATOR */}
      <div className="mt-auto pt-6 relative z-10 flex items-center gap-2">
        <div
          style={{ color: BRAND.magenta }}
          className={`transition-opacity duration-300 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
        >
          <Activity size={12} className="animate-pulse" />
        </div>

        <span
          className={`
            text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${selected
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2.5 group-hover:opacity-100 group-hover:translate-x-0"
            }
          `}
          style={{ color: BRAND.magenta }}
        >
          {selected ? "Active Tool" : "Initialize Tool →"}
        </span>
      </div>
    </motion.div>
  );
};
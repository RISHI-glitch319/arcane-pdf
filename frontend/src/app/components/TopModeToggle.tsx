"use client";

import React from "react";
import { useMode } from "../context/ModeContext";
import { FileText, Image as ImageIcon } from "lucide-react";

const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
};

export const TopModeToggle: React.FC = () => {
  const { mode, setMode } = useMode();

  return (
    <div className="w-full flex justify-center py-4 relative z-50">
      <div className="inline-flex items-center p-1 rounded-2xl backdrop-blur-xl border transition-all bg-black/40 border-[#CC208E]/20">
        <button
          onClick={() => setMode("pdf")}
          className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2 ${
            mode === "pdf"
              ? "bg-[#CC208E] text-white shadow-lg shadow-[#CC208E]/30"
              : "text-white hover:text-[#CC208E] hover:bg-white/10"
          }`}
        >
          <FileText size={16} />
          Arcane PDF
        </button>
        <button
          onClick={() => setMode("img")}
          className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2 ${
            mode === "img"
              ? "bg-[#CC208E] text-white shadow-lg shadow-[#CC208E]/30"
              : "text-white hover:text-[#CC208E] hover:bg-white/10"
          }`}
        >
          <ImageIcon size={16} />
          Arcane IMG
        </button>
      </div>
    </div>
  );
};

/**
 * Standard Tool Layout Component
 * Provides consistent error handling, loading states, and accessibility
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Info, Loader2 } from "lucide-react";

interface ToolLayoutProps {
  children: React.ReactNode;
  dark: boolean;
  loading?: boolean;
  error?: string | null;
  onError?: (error: string | null) => void;
}

export const ToolLayout = ({
  children,
  dark,
  loading = false,
  error = null,
  onError,
}: ToolLayoutProps) => {
  return (
    <div
      className={`transition-colors duration-700 min-h-screen relative overflow-x-hidden ${
        dark ? "bg-[#050412] text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-4 right-4 z-[200] p-4 rounded-lg border flex items-start gap-3 ${
              dark
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Error</p>
              <p className="text-xs opacity-90 mt-1">{error}</p>
            </div>
            {onError && (
              <button
                onClick={() => onError(null)}
                className="flex-shrink-0 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className={`p-8 rounded-2xl backdrop-blur-2xl ${
                dark
                  ? "bg-black/40 border border-white/10"
                  : "bg-white/80 border border-slate-200"
              }`}
            >
              <Loader2 size={40} className="animate-spin mx-auto mb-4" />
              <p className="text-sm font-semibold">Processing...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
};

interface ToolHeaderProps {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  dark: boolean;
}

export const ToolHeader = ({
  title,
  icon,
  subtitle,
  dark,
}: ToolHeaderProps) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-lg ${
            dark ? "bg-white/5" : "bg-slate-100"
          }`}
        >
          {icon}
        </div>
        <div>
          <h1
            className={`text-4xl md:text-5xl font-black italic uppercase tracking-tight leading-none ${
              dark ? "text-white" : "text-slate-900"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={`mt-2 text-sm font-semibold opacity-60 ${
                dark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.header>
  );
};

interface ToolCardProps {
  children: React.ReactNode;
  dark: boolean;
  className?: string;
}

export const ToolCard = ({ children, dark, className = "" }: ToolCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-1 rounded-[2rem] backdrop-blur-3xl ${
        dark
          ? "bg-white/5 border border-white/5 shadow-2xl"
          : "bg-white border border-slate-200 shadow-lg"
      } ${className}`}
    >
      <div className="p-8 md:p-12">{children}</div>
    </motion.div>
  );
};

interface ToolInfoProps {
  children: React.ReactNode;
  dark: boolean;
}

export const ToolInfo = ({ children, dark }: ToolInfoProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className={`flex items-start gap-3 p-4 rounded-lg border ${
        dark
          ? "bg-white/5 border-white/10 text-slate-400"
          : "bg-blue-50 border-blue-200 text-blue-900"
      }`}
    >
      <Info size={20} className="flex-shrink-0 mt-0.5" />
      <div className="text-sm">{children}</div>
    </motion.div>
  );
};

interface ToolStatProps {
  label: string;
  value: string;
  dark: boolean;
}

export const ToolStat = ({ label, value, dark }: ToolStatProps) => {
  return (
    <div
      className={`p-4 rounded-lg text-center ${
        dark ? "bg-white/5 border border-white/10" : "bg-slate-100 border border-slate-200"
      }`}
    >
      <p className="text-xs font-bold uppercase opacity-60 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

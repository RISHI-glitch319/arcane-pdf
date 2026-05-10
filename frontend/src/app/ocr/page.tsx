"use client";


import { API_BASE } from "@/config/api";
import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, Download, Loader2, Sparkles, Zap,
  RefreshCcw, ShieldCheck, ArrowLeft, Terminal, Sun, Moon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import Link from "next/link";
import { useObjectURL } from "@/hooks/useObjectURL";
import { downloadBinaryData } from "@/utils/binaryHandling";

const BRAND = { magenta: "#CC208E", purple: "#6713D2", bgDark: "#050412" };

export default function OCRTool() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [dark, setDark] = useState(true);

  
  // Use object URL hook for automatic cleanup
  const previewUrl = useObjectURL(file);
  const downloadUrl = useObjectURL(downloadBlob);

  useEffect(() => {
    // Initialize theme from system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(prefersDark);
  }, []);

  const toggleTheme = useCallback(() => {
    setDark(prev => !prev);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.includes("pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size exceeds 50MB limit");
      return;
    }

    setFile(selectedFile);
    setStep(2);
    setError("");
  }, []);

  const runOCR = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API_BASE}/ocr-pdf-layout`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
        timeout: 120000,
      });

      if (res.data instanceof Blob) {
        setDownloadBlob(res.data);
      } else {
        setError("Invalid response from server");
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || "OCR processing failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [file, API_BASE]);

  const handleDownload = useCallback(async () => {
    if (!downloadBlob || !file) return;
    try {
      await downloadBinaryData(
        downloadBlob,
        `Searchable_${file.name}`,
        "application/pdf"
      );
    } catch (err) {
      setError("Download failed");
    }
  }, [downloadBlob, file]);

  const resetEngine = useCallback(() => {
    setFile(null);
    setDownloadBlob(null);
    setStep(1);
    setError("");
  }, []);

  return (
    <main className={`min-h-screen transition-colors duration-700 p-6 lg:p-16 relative overflow-hidden ${dark ? "bg-[#050412] text-slate-200" : "bg-slate-50 text-slate-900"}`}>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-black to-slate-900" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <Link href="/" className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] mb-4 hover:opacity-100 transition-all ${dark ? "text-[#CC208E]" : "text-slate-500"}`}>
              <ArrowLeft size={14} /> Back to Architecture
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-[#CC208E]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#CC208E]">Sovereign Vision Shard</span>
            </div>
            <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
              Neural <span style={{ color: BRAND.magenta }}>OCR</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className={`p-5 rounded-full border transition-all ${dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900 shadow-xl"}`}>
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {step > 1 && (
              <button onClick={resetEngine} className={`p-5 rounded-full border transition-all hover:rotate-180 duration-500 ${dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900 shadow-xl"}`}>
                <RefreshCcw size={20} />
              </button>
            )}
          </div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-center text-[10px] font-black uppercase tracking-widest">
              <Zap size={14} className="inline mr-2" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className={`w-full p-1 rounded-[3.5rem] border backdrop-blur-3xl shadow-2xl overflow-hidden ${dark ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-xl"}`}>
          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label className={`flex flex-col items-center justify-center w-full h-96 border-2 border-dashed rounded-[3rem] cursor-pointer transition-all duration-500 group ${dark ? "border-white/10 bg-black/20 hover:border-[#CC208E]/50" : "border-slate-200 bg-slate-50 hover:border-[#CC208E]"}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText size={64} className="mb-4 opacity-20 group-hover:opacity-100 transition-all group-hover:scale-110" style={{ color: BRAND.magenta }} />
                      <p className="text-sm font-black uppercase tracking-widest mb-2">Inject Matrix Shard</p>
                      <p className="text-[10px] uppercase opacity-40 tracking-tighter italic">Awaiting Scanned PDF Distillation</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                  </label>
                </motion.div>
              ) : (
                <motion.div key="process" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-stretch min-h-[500px]">
                    <div className={`rounded-3xl border-4 overflow-hidden relative shadow-2xl ${dark ? "border-white/5 bg-black" : "border-slate-100 bg-slate-200"}`}>
                      {previewUrl && (
                        <iframe src={`${previewUrl}#toolbar=0&navpanes=0`} className={`w-full h-full border-none transition-all duration-1000 ${loading ? 'blur-md opacity-20' : 'opacity-100'}`} title="OCR Preview" />
                      )}
                      <div className="absolute top-6 left-6 px-4 py-1.5 rounded-full bg-[#CC208E] text-[10px] font-black text-white uppercase shadow-lg">Matrix Preview</div>
                    </div>

                    <div className="flex flex-col justify-between py-4">
                      <div>
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-6">Distillation <span className="text-[#CC208E]">Console</span></h3>
                        <p className={`text-xs font-bold leading-relaxed mb-8 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                          This sequence maps neural text coordinates over the original background matrix.
                        </p>
                        <div className={`p-6 rounded-3xl mb-8 border ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                          <p className="text-[9px] font-black uppercase opacity-40 mb-2">Target Asset</p>
                          <p className="text-xs font-black uppercase italic truncate">{file?.name}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {!downloadBlob ? (
                          <button
                            onClick={runOCR}
                            disabled={loading}
                            className={`w-full py-6 rounded-2xl font-black uppercase italic flex items-center justify-center gap-4 shadow-xl transition-all hover:scale-[1.02] active:scale-95 ${dark ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}
                          >
                            {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                            {loading ? "Distilling Matrix..." : "Begin OCR Synthesis"}
                          </button>
                        ) : (
                          <button
                            onClick={handleDownload}
                            className="w-full py-6 rounded-2xl bg-gradient-to-r from-[#CC208E] to-[#6713D2] text-white font-black uppercase italic flex items-center justify-center gap-4 shadow-2xl hover:brightness-110 transition-all"
                          >
                            <Download size={20} /> Download Searchable PDF
                          </button>
                        )}
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border italic text-[9px] opacity-40 uppercase font-black tracking-widest ${dark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                          <Terminal size={12} /> Status: {loading ? "Neural Mapping Active" : downloadBlob ? "Synthesis Successful" : "Awaiting Pulse"}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <p className="mt-12 text-[9px] font-black uppercase tracking-[0.6em] opacity-20 text-center">
          Arcane Sovereign Engine • OCR Synthesis Shard • Secured In Docker
        </p>
      </div>
    </main>
  );
}
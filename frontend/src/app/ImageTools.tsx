"use client";


import { API_BASE } from "@/config/api";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minimize2,
  Maximize2,
  Crop,
  FileImage,
  Upload,
  X,
  Download,
  FileText,
  Film,
  Settings,
  Trash2,
  Image as ImageIcon,
  Zap,
  RotateCcw,
  Droplets,
} from "lucide-react";
import { ToolCard } from "./ToolCard";

/* ================= BRAND CONSTANTS ================= */
const BRAND = {
  magenta: "#CC208E",
  purple: "#6713D2",
};

/* ================= TYPES ================= */
interface ImagePreview {
  id: string;
  url: string;
  name: string;
  type: string;
}

interface ProcessedFileData {
  url?: string;
  filename?: string;
}

interface ToolDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

/* ================= TOOLS CONFIGURATION ================= */
const IMAGE_TOOLS: ToolDefinition[] = [
  { id: "compress", slug: "compress", title: "Compress Image", description: "Reduce image file size efficiently with smart compression.", icon: Minimize2 },
  { id: "resize", slug: "resize", title: "Resize Image", description: "Change dimensions with precision while maintaining aspect ratio.", icon: Maximize2 },
  { id: "convert", slug: "convert", title: "Convert Format", description: "Convert between JPG, PNG, WEBP, and other formats.", icon: FileImage },
  { id: "enhance", slug: "enhance", title: "Enhance Image", description: "Improve brightness, contrast, and sharpness automatically.", icon: Zap },
  { id: "ocr", slug: "ocr", title: "OCR Extract", description: "Extract text from images using offline OCR engine.", icon: FileText },
  { id: "create-gif", slug: "create-gif", title: "Create GIF", description: "Combine multiple images into an animated GIF.", icon: Film },
  { id: "crop", slug: "crop", title: "Crop Image", description: "Trim edges and remove unwanted areas precisely.", icon: Crop },
  { id: "rotate", slug: "rotate", title: "Rotate & Flip", description: "Rotate or flip images in any direction.", icon: RotateCcw },
  { id: "watermark", slug: "watermark", title: "Add Watermark", description: "Overlay text or image watermarks for protection.", icon: Droplets },
];

/* ================= UTILITY FUNCTIONS ================= */
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ImageTools: React.FC<{ dark: boolean }> = ({ dark }) => {
  // --- STATES ---
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [inputFiles, setInputFiles] = useState<ImagePreview[]>([]);
  const [outputFiles, setOutputFiles] = useState<ImagePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TOOL PARAMETER STATES ---
  const [cropParams, setCropParams] = useState({ x: 0, y: 0, width: 300, height: 300 });
  const [gifParams, setGifParams] = useState({ duration: 500, loop: 0 });
  const [rotateParams, setRotateParams] = useState({ angle: 90, flip: 'none' as 'none' | 'horizontal' | 'vertical' });

  // --- REFS FOR CLEANUP ---
  const inputUrlsRef = useRef<Set<string>>(new Set());
  const outputUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      inputUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      outputUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // FIX #1: Reset states when tool changes
  useEffect(() => {
    if (selectedTool) {
      // Clear output files from previous tool
      outputFiles.forEach(file => {
        if (file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
          outputUrlsRef.current.delete(file.url);
        }
      });
      setOutputFiles([]);
      setError(null);

      // Reset file input so same files can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTool]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(event.target.files || []);
    const previews: ImagePreview[] = files.map(file => {
      const url = URL.createObjectURL(file);
      inputUrlsRef.current.add(url);
      return {
        id: generateId(),
        url,
        name: file.name,
        type: file.type,
      };
    });
    setInputFiles(prev => [...prev, ...previews]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setInputFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.url);
        inputUrlsRef.current.delete(fileToRemove.url);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const clearAllFiles = useCallback(() => {
    inputFiles.forEach(file => {
      URL.revokeObjectURL(file.url);
      inputUrlsRef.current.delete(file.url);
    });
    outputFiles.forEach(file => {
      if (file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
        outputUrlsRef.current.delete(file.url);
      }
    });
    setInputFiles([]);
    setOutputFiles([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [inputFiles, outputFiles]);

  const clearOutput = useCallback(() => {
    outputFiles.forEach(file => {
      if (file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
        outputUrlsRef.current.delete(file.url);
      }
    });
    setOutputFiles([]);
  }, [outputFiles]);

  const processImages = useCallback(async () => {
    if (!selectedTool || inputFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);

    console.log(`Processing ${inputFiles.length} images with tool: ${selectedTool}`);

    try {
      const formData = new FormData();
      for (const file of inputFiles) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        formData.append('files', blob, file.name);
      }

      let endpoint = `${API_BASE}/api/image/${selectedTool}`;
      if (selectedTool === "create-gif") endpoint = `${API_BASE}/img/create-gif`;
      if (selectedTool === "crop") endpoint = `${API_BASE}/img/crop`;
      if (selectedTool === "rotate") endpoint = `${API_BASE}/img/rotate`;
      
      console.log(`Using endpoint: ${endpoint} for tool: ${selectedTool}`);

      // Append tool-specific parameters
      switch (selectedTool) {
        case "create-gif":
          formData.append("duration", gifParams.duration.toString());
          formData.append("loop", gifParams.loop.toString());
          break;
        case "crop":
          formData.append("x", cropParams.x.toString());
          formData.append("y", cropParams.y.toString());
          formData.append("width", cropParams.width.toString());
          formData.append("height", cropParams.height.toString());
          break;
        case "rotate":
          formData.append("angle", rotateParams.angle.toString());
          formData.append("flip", rotateParams.flip);
          break;
      }

      const response = await fetch(endpoint, { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(`Processing failed with status: ${response.status}`);
      }

      const result = await response.json();
      const filesArray = Array.isArray(result.data) ? result.data : [result.data];

      const outputPreviews: ImagePreview[] = filesArray.map((fileData: string | ProcessedFileData, index: number) => {
        const originalFile = inputFiles[index] || inputFiles[0];
        const rawPath = typeof fileData === 'string' ? fileData : (fileData.url || fileData.filename || '');
        const isBase64 = rawPath.startsWith('data:image');
        const finalUrl = isBase64 ? rawPath : `${API_BASE}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

        if (finalUrl.startsWith('blob:')) {
          outputUrlsRef.current.add(finalUrl);
        }

        return {
          id: generateId(),
          url: finalUrl,
          name: `processed_${originalFile.name}`,
          type: rawPath.toLowerCase().includes('.gif') ? 'image/gif' : originalFile.type,
        };
      });

      setOutputFiles(outputPreviews);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Processing failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTool, inputFiles, cropParams, gifParams, rotateParams]);

  const downloadFile = useCallback((file: ImagePreview) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadAll = useCallback(() => {
    outputFiles.forEach((file, index) => {
      setTimeout(() => downloadFile(file), index * 200);
    });
  }, [outputFiles, downloadFile]);

  const currentTool = IMAGE_TOOLS.find(t => t.id === selectedTool);

  // Debug: Log available tools and current selection
  console.log('Available tools:', IMAGE_TOOLS.map(t => ({ id: t.id, title: t.title })));
  console.log('Selected tool:', selectedTool);
  console.log('Current tool:', currentTool?.title || 'None');

  return (
    <div className={`min-h-screen p-6 transition-colors duration-500 ${dark ? 'bg-[#050412]' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto">
        {/* --- HEADER --- */}
        <div className="text-center mb-8">
          <h1 className={`text-4xl md:text-5xl font-black uppercase italic mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
            Image <span style={{ color: BRAND.magenta }}>Alchemy</span>
          </h1>
          <p className={`text-sm font-medium ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            Select a tool below to begin transforming your images
          </p>
        </div>

        {/* --- TOOL SELECTION GRID --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4 pt-4 pb-10 relative z-10">
          <AnimatePresence mode="popLayout">
            {IMAGE_TOOLS.map((tool) => {
              console.log(`Rendering tool card: ${tool.title} (ID: ${tool.id}), selected: ${selectedTool === tool.id}`);
              
              // Defensive check: ensure all required props exist
              if (!tool.id || !tool.title || !tool.description || !tool.icon) {
                console.error(`Tool missing required props:`, tool);
                return null;
              }
              
              return (
                <ToolCard
                  key={tool.id}
                  title={tool.title}
                  description={tool.description}
                  onClick={() => {
                    console.log(`Tool clicked: ${tool.title} (ID: ${tool.id})`);
                    setSelectedTool(tool.id);
                  }}
                  icon={tool.icon}
                  dark={dark}
                  selected={selectedTool === tool.id}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* --- MAIN WORKSPACE --- */}
        <AnimatePresence mode="wait">
          {selectedTool && (
            <motion.div
              key={selectedTool}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className={`p-8 rounded-[2.5rem] border-2 ${dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'} mb-12`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h2 className={`text-3xl font-black uppercase italic ${dark ? 'text-white' : 'text-slate-900'}`}>
                    Active Tool: <span style={{ color: BRAND.magenta }}>{currentTool?.title || selectedTool.replace('-', ' ')}</span>
                  </h2>
                  <p className={dark ? 'text-slate-400' : 'text-slate-600'}>
                    {currentTool?.description || 'Upload your assets to begin processing.'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-2 bg-[#CC208E] text-white rounded-full font-bold hover:scale-105 transition-all"
                  >
                    <Upload size={18} /> Upload Images
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  {inputFiles.length > 0 && (
                    <button
                      onClick={clearAllFiles}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                      aria-label="Clear all files"
                    >
                      <Trash2 size={24} />
                    </button>
                  )}
                </div>
              </div>

              {/* --- ERROR MESSAGE --- */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold"
                  >
                    ⚠️ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* --- INPUT PREVIEW GRID --- */}
              {inputFiles.length > 0 && (
                <div className="mb-8">
                  <h3 className={`text-sm font-bold uppercase mb-4 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Input Images ({inputFiles.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {inputFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-[#CC208E] transition-all"
                      >
                        <img src={file.url} className="w-full h-full object-cover" alt={`Upload preview ${file.name}`} />
                        <button
                          onClick={() => removeFile(file.id)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X size={12} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- EMPTY STATE --- */}
              {inputFiles.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed ${dark ? 'border-white/10 text-slate-500' : 'border-slate-300 text-slate-400'}`}
                >
                  <ImageIcon size={48} className="mb-4 opacity-50" />
                  <p className="text-sm font-bold uppercase">No images uploaded yet</p>
                  <p className="text-xs mt-1 opacity-70">Click "Upload Images" to get started</p>
                </motion.div>
              )}

              {/* --- TOOL SPECIFIC SETTINGS --- */}
              {(selectedTool === 'crop' || selectedTool === 'create-gif' || selectedTool === 'rotate') && (
                <div className={`p-6 rounded-2xl mb-8 ${dark ? 'bg-black/40' : 'bg-white'} border border-white/10`}>
                  <div className="flex items-center gap-2 mb-4 font-bold uppercase text-xs" style={{ color: BRAND.magenta }}>
                    <Settings size={16} /> Configuration
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {selectedTool === 'crop' && (
                      <>
                        {Object.entries(cropParams).map(([key, val]) => (
                          <div key={key}>
                            <label className="block text-[10px] font-black uppercase mb-1 opacity-50">{key} (px)</label>
                            <input
                              type="number"
                              min={0}
                              value={val}
                              onChange={(e) => setCropParams(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                              className={`w-full p-2 rounded-lg bg-transparent border ${dark ? 'border-white/10 text-white' : 'border-black/10 text-black'}`}
                            />
                          </div>
                        ))}
                      </>
                    )}
                    {selectedTool === 'rotate' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-1 opacity-50">Angle (degrees)</label>
                          <input
                            type="number"
                            min={0}
                            max={360}
                            value={rotateParams.angle}
                            onChange={(e) => setRotateParams(p => ({ ...p, angle: parseInt(e.target.value) || 0 }))}
                            className={`w-full p-2 rounded-lg bg-transparent border ${dark ? 'border-white/10 text-white' : 'border-black/10 text-black'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-1 opacity-50">Flip</label>
                          <select
                            value={rotateParams.flip}
                            onChange={(e) => setRotateParams(p => ({ ...p, flip: e.target.value as 'none' | 'horizontal' | 'vertical' }))}
                            className={`w-full p-2 rounded-lg bg-transparent border ${dark ? 'border-white/10 text-white' : 'border-black/10 text-black'}`}
                          >
                            <option value="none">None</option>
                            <option value="horizontal">Horizontal</option>
                            <option value="vertical">Vertical</option>
                          </select>
                        </div>
                      </>
                    )}
                    {selectedTool === 'create-gif' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-1 opacity-50">Duration (ms)</label>
                          <input
                            type="number"
                            min={100}
                            value={gifParams.duration}
                            onChange={(e) => setGifParams(p => ({ ...p, duration: parseInt(e.target.value) || 500 }))}
                            className={`w-full p-2 rounded-lg bg-transparent border ${dark ? 'border-white/10 text-white' : 'border-black/10 text-black'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase mb-1 opacity-50">Loop (0 = Infinite)</label>
                          <input
                            type="number"
                            min={0}
                            value={gifParams.loop}
                            onChange={(e) => setGifParams(p => ({ ...p, loop: parseInt(e.target.value) || 0 }))}
                            className={`w-full p-2 rounded-lg bg-transparent border ${dark ? 'border-white/10 text-white' : 'border-black/10 text-black'}`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* --- PROCESS TRIGGER --- */}
              {inputFiles.length > 0 && (
                <div className="flex justify-center mb-8">
                  <button
                    onClick={processImages}
                    disabled={isProcessing}
                    className="px-12 py-4 bg-gradient-to-r from-[#CC208E] to-[#6713D2] text-white rounded-full font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Synthesizing..." : "Initialize Distillation"}
                  </button>
                </div>
              )}

              {/* --- OUTPUT PREVIEW GRID --- */}
              {outputFiles.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-sm font-bold uppercase flex items-center gap-2 ${dark ? 'text-green-400' : 'text-green-600'}`}>
                      <ImageIcon size={16} /> Distilled Assets ({outputFiles.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadAll}
                        className="text-xs font-bold px-4 py-2 rounded-full border border-[#CC208E] text-[#CC208E] hover:bg-[#CC208E] hover:text-white transition-all"
                      >
                        Download All
                      </button>
                      <button
                        onClick={clearOutput}
                        className="text-xs font-bold px-4 py-2 rounded-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Clear Output
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {outputFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`p-4 rounded-3xl border-2 ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5'} group`}
                      >
                        <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-black/20">
                          <img src={file.url} className="w-full h-full object-contain" alt={`Processed ${file.name}`} />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold truncate max-w-[150px] opacity-50 uppercase">{file.name}</span>
                          <button
                            onClick={() => downloadFile(file)}
                            className="p-2 bg-[#CC208E] text-white rounded-lg hover:scale-110 transition-all"
                            aria-label={`Download ${file.name}`}
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ImageTools;
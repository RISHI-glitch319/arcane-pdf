"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";

type UniversalPreviewProps = {
  dark: boolean;
  title: string;
  caption: string;
  file: File | null;
  fileType: 'pdf' | 'image' | 'docx' | 'pptx' | 'xlsx' | 'placeholder';
  previewUrl?: string | null;
  children?: ReactNode;
};

export function UniversalPreviewCard({ 
  dark, 
  title, 
  caption, 
  file, 
  fileType, 
  previewUrl, 
  children 
}: UniversalPreviewProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (previewUrl) {
      setLocalPreviewUrl(previewUrl);
    } else if (file) {
      // Generate preview based on file type
      if (fileType === 'image') {
        setLocalPreviewUrl(URL.createObjectURL(file));
      } else if (fileType === 'pdf') {
        // For PDF, we'll use the preview URL that comes from backend
        setLocalPreviewUrl(null); // Will be set by parent
      } else if (fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx') {
        // For Office documents, show placeholder
        setLocalPreviewUrl(null);
      }
    }
  }, [file, previewUrl, fileType]);

  const renderPreview = () => {
    if (localPreviewUrl) {
      if (fileType === 'image') {
        return (
          <img 
            src={localPreviewUrl} 
            alt={title} 
            className="w-full h-full object-contain rounded-[1.25rem]" 
          />
        );
      } else if (fileType === 'pdf') {
        return (
          <iframe 
            src={`${localPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
            title={title} 
            className="h-full w-full border-none" 
          />
        );
      } else if (fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx') {
        // Show file icon and placeholder for Office documents
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
              dark ? 'bg-slate-800' : 'bg-slate-200'
            }`}>
              {fileType === 'docx' && (
                <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0-2-2v2a2 2 0 0 2 2h2l-2-2 2 2v2a2 2 0 0 2 2h2a2 2 0 0 2-2z"/>
                </svg>
              )}
              {fileType === 'pptx' && (
                <svg className="w-12 h-12 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 3h10a1 1 0 0-1-1v2a1 1 0 0 1 1h10a1 1 0 0 1-1v2a1 1 0 0 1 1h10a1 1 0 0 1-1z"/>
                </svg>
              )}
              {fileType === 'xlsx' && (
                <svg className="w-12 h-12 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h18a1 1 0 0-1-1v2a1 1 0 0 1 1h18a1 1 0 0 1 1v2a1 1 0 0 1 1h18a1 1 0 0 1-1z"/>
                </svg>
              )}
            </div>
            <div className="text-center">
              <h3 className={`text-lg font-semibold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
                {file?.name}
              </h3>
              <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                {fileType === 'docx' && 'Word Document'}
                {fileType === 'pptx' && 'PowerPoint Presentation'}
                {fileType === 'xlsx' && 'Excel Spreadsheet'}
              </p>
              <p className={`text-xs mt-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Preview will be generated after processing
              </p>
            </div>
          </div>
        );
      }
    }

    // Placeholder for missing preview
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 ${
        dark ? 'bg-slate-800' : 'bg-slate-100'
      }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          dark ? 'bg-slate-700' : 'bg-slate-200'
        }`}>
          <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 2h6a2 2 0 0-2-2v2a2 2 0 0 2 2h2l-2-2 2 2v2a2 2 0 0 2 2z"/>
          </svg>
        </div>
        <div className="text-center">
          <h3 className={`text-lg font-semibold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
            No Preview Available
          </h3>
          <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            {fileType === 'placeholder' && 'Upload a file to preview'}
            {fileType !== 'placeholder' && 'Processing file...'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section
      className={`rounded-[2.25rem] border p-5 md:p-6 transition-all ${
        dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${
            dark ? "text-slate-500" : "text-slate-400"
          }`}>
            Universal Preview
          </p>
          <h2 className={`text-sm font-black uppercase tracking-[0.25em] ${
            dark ? "text-white" : "text-slate-900"
          }`}>
            {title}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] ${
            dark ? "bg-[#CC208E]/10 text-[#f472b6]" : "bg-[#CC208E]/10 text-[#CC208E]"
          }`}
        >
          {caption}
        </span>
      </div>
      
      {children}
      
      {/* Universal Preview */}
      <div className="mt-4">
        {renderPreview()}
      </div>
    </section>
  );
}

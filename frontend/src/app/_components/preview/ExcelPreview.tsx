"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { readFileAsArrayBuffer, validateFileReaderResult, toUint8Array } from "@/utils/binaryHandling";

interface ExcelPreviewProps {
    file: File | null;
}

// Define a proper type for rows
type ExcelRow = (string | number | null)[];

export const ExcelPreview = React.memo(({ file }: ExcelPreviewProps) => {
    const [sheets, setSheets] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState<string>("");
    const [excelData, setExcelData] = useState<ExcelRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoized workbook to avoid re-reading file
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

    useEffect(() => {
        if (!file) {
            setSheets([]);
            setExcelData([]);
            setWorkbook(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        readFileAsArrayBuffer(file)
            .then(async (buffer) => {
                try {
                    const data = await toUint8Array(buffer);
                    const wb = XLSX.read(data, { type: "array" });
                    setWorkbook(wb);
                    setSheets(wb.SheetNames);

                    const firstSheet = wb.SheetNames[0];
                    setActiveSheet(firstSheet);
                    loadSheet(wb, firstSheet);
                } catch (err) {
                    setError(`Excel parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
                    console.error("Excel parse error:", err);
                } finally {
                    setLoading(false);
                }
            })
            .catch((err) => {
                setError(`File read error: ${err instanceof Error ? err.message : "Unknown error"}`);
                console.error("File read error:", err);
                setLoading(false);
            });
    }, [file]);

    const loadSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
        try {
            const worksheet = wb.Sheets[sheetName];
            if (!worksheet) {
                setError(`Sheet "${sheetName}" not found`);
                return;
            }

            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                blankrows: false,
            }) as ExcelRow[];

            setExcelData(jsonData);
            setError(null);
        } catch (err) {
            setError(`Sheet load error: ${err instanceof Error ? err.message : "Unknown error"}`);
            console.error("Sheet load error:", err);
        }
    }, []);

    const handleSheetChange = useCallback((sheet: string) => {
        if (workbook) {
            setActiveSheet(sheet);
            loadSheet(workbook, sheet);
        }
    }, [workbook, loadSheet]);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="inline-block">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-[#CC208E] rounded-full animate-spin"></div>
                </div>
                <p className="mt-2 text-sm text-gray-600">Loading Excel...</p>
            </div>
        );
    }

    if (!file) return null;

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 text-sm font-semibold">Error loading file</div>
                <p className="mt-2 text-xs text-gray-600">{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

            {/* HEADER */}
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pro Excel Viewer
                </span>
                <span className="text-xs text-blue-500">{file.name}</span>
            </div>

            {/* SHEET TABS */}
            <div className="flex gap-2 p-2 border-b overflow-x-auto bg-gray-100">
                {sheets.map((sheet) => (
                    <button
                        key={sheet}
                        onClick={() => handleSheetChange(sheet)}
                        className={`px-3 py-1 text-xs rounded-md font-semibold transition ${activeSheet === sheet
                                ? "bg-[#CC208E] text-white"
                                : "bg-white text-gray-600 border"
                            }`}
                    >
                        {sheet}
                    </button>
                ))}
            </div>

            {/* TABLE */}
            <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm border-collapse">

                    {/* COLUMN HEADERS */}
                    <thead className="sticky top-0 bg-gray-200 z-20">
                        <tr>
                            <th className="border w-10 bg-slate-300"></th>
                            {excelData[0]?.map((_, colIndex) => (
                                <th
                                    key={colIndex}
                                    className="border px-3 py-2 text-xs font-bold"
                                >
                                    {String.fromCharCode(65 + colIndex)}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {excelData.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">

                                {/* ROW INDEX */}
                                <td className="sticky left-0 bg-gray-100 text-xs text-center border w-10">
                                    {i + 1}
                                </td>

                                {/* CELLS */}
                                {row.map((cell, j) => (
                                    <td
                                        key={j}
                                        className="border px-3 py-2 min-w-[120px] text-gray-800"
                                    >
                                        {cell !== null && cell !== undefined
                                            ? cell.toString()
                                            : ""}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});
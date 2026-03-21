'use client';

import { useState, useCallback } from 'react';

type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error';

type OcrResult = {
    text: string;
    confidence: number;
};

/**
 * Client-side OCR hook that sends files to the server-side PaddleOCR endpoint.
 * The actual OCR runs server-side via PaddleOCR v5 + ONNX Runtime for
 * maximum accuracy and performance. No WASM/model downloads in the browser.
 */
export function useOcrWorker() {
    const [status, setStatus] = useState<OcrStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<OcrResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const processImage = useCallback(async (file: File) => {
        setStatus('loading');
        setProgress(10);
        setError(null);
        setResult(null);

        try {
            setStatus('recognizing');
            setProgress(30);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('ocr', 'true');

            const res = await fetch('/api/import', { method: 'POST', body: formData });
            setProgress(80);

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const ocrResult: OcrResult = {
                text: data.ocrText ?? '',
                confidence: data.ocrConfidence ?? 0,
            };

            setResult(ocrResult);
            setStatus('done');
            setProgress(100);
            return ocrResult;
        } catch (err: any) {
            setError(err.message || 'OCR processing failed');
            setStatus('error');
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    return { status, progress, result, error, processImage, reset };
}

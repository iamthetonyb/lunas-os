'use client';

import { useState, useCallback, useRef } from 'react';

type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error';

type OcrResult = {
    text: string;
    confidence: number;
};

/**
 * Client-side OCR via Tesseract.js Web Worker.
 * Processes images and PDFs (as images) without blocking the UI.
 * Language models are loaded on-demand (eng only by default).
 */
export function useOcrWorker() {
    const [status, setStatus] = useState<OcrStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<OcrResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<any>(null);

    const processImage = useCallback(async (imageSource: File | string) => {
        setStatus('loading');
        setProgress(0);
        setError(null);
        setResult(null);

        try {
            // Dynamic import — only loads tesseract.js when needed
            const Tesseract = await import('tesseract.js');

            setStatus('recognizing');

            // Convert File to object URL if needed
            let src: string;
            if (imageSource instanceof File) {
                src = URL.createObjectURL(imageSource);
            } else {
                src = imageSource;
            }

            const worker = await Tesseract.createWorker('eng', undefined, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round((m.progress ?? 0) * 100));
                    }
                },
            });

            workerRef.current = worker;

            const { data } = await worker.recognize(src);

            // Clean up object URL
            if (imageSource instanceof File) {
                URL.revokeObjectURL(src);
            }

            await worker.terminate();
            workerRef.current = null;

            const ocrResult: OcrResult = {
                text: data.text,
                confidence: data.confidence,
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

    const cancel = useCallback(async () => {
        if (workerRef.current) {
            await workerRef.current.terminate();
            workerRef.current = null;
        }
        setStatus('idle');
        setProgress(0);
    }, []);

    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
        setResult(null);
        setError(null);
    }, []);

    return { status, progress, result, error, processImage, cancel, reset };
}

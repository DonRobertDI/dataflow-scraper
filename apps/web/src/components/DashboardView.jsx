import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Link2, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import ResultsPanel from '@/components/ResultsPanel';
import { exportCsv, exportPdf } from '@/lib/dataflow';
import { scrapeUrl } from '@/lib/api';

const isValidUrl = (value) => {
    if (value.trim().length > 2048) return false;
    try {
        const u = new URL(value.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const DashboardView = ({ toast, onExtractionComplete, viewJob, onClearViewedJob }) => {
    const [url, setUrl] = useState(viewJob ? viewJob.sourceUrl : '');
    const [status, setStatus] = useState(
        viewJob ? (viewJob.status === 'success' ? 'success' : 'error') : 'idle',
    );
    const [rows, setRows] = useState(viewJob ? viewJob.products : []);
    const [sourceUrl, setSourceUrl] = useState(viewJob ? viewJob.sourceUrl : '');
    const [warnings, setWarnings] = useState(viewJob ? viewJob.warnings : []);
    const [extractionError, setExtractionError] = useState(
        viewJob?.status === 'failed'
            ? { code: viewJob.errorCode, message: viewJob.error }
            : null,
    );
    const requestRef = useRef(null);

    const isExtracting = status === 'loading';

    useEffect(
        () => () => {
            requestRef.current?.abort();
        },
        [],
    );

    useEffect(() => {
        if (!viewJob) return;
        setUrl(viewJob.sourceUrl);
        setStatus(viewJob.status === 'success' ? 'success' : 'error');
        setRows(viewJob.products || []);
        setSourceUrl(viewJob.sourceUrl);
        setWarnings(viewJob.warnings || []);
        setExtractionError(
            viewJob.status === 'failed'
                ? { code: viewJob.errorCode, message: viewJob.error }
                : null,
        );
    }, [viewJob]);

    const handleUrlChange = (event) => {
        const nextUrl = event.target.value;
        setUrl(nextUrl);
        if (status !== 'idle' && nextUrl.trim() !== sourceUrl) {
            setStatus('idle');
            setRows([]);
            setSourceUrl('');
            setWarnings([]);
            setExtractionError(null);
        }
        if (viewJob) onClearViewedJob?.();
    };

    const handleExtract = async () => {
        if (requestRef.current) return;
        onClearViewedJob?.();
        if (!isValidUrl(url)) {
            setStatus('error');
            setRows([]);
            setWarnings([]);
            setExtractionError({
                code: 'invalid_url',
                message: 'Enter a valid product URL starting with http:// or https://.',
            });
            toast({
                variant: 'destructive',
                title: 'Invalid URL',
                description: 'Please enter a valid product URL starting with http:// or https://',
            });
            return;
        }

        setStatus('loading');
        setRows([]);
        setSourceUrl('');
        setWarnings([]);
        setExtractionError(null);
        const cleanUrl = url.trim();
        const controller = new AbortController();
        requestRef.current = controller;

        try {
            const result = await scrapeUrl(cleanUrl, { signal: controller.signal });
            if (controller.signal.aborted) return;
            setRows(result.products);
            setSourceUrl(result.sourceUrl);
            setWarnings(result.warnings);
            setStatus('success');
            setExtractionError(null);
            toast({
                title: 'Extraction complete',
                description: `${result.products.length} ${result.products.length === 1 ? 'product' : 'products'} extracted successfully.`,
            });
            onExtractionComplete?.(result);
        } catch (error) {
            if (controller.signal.aborted) return;
            setStatus('error');
            setRows([]);
            setSourceUrl('');
            setWarnings([]);
            setExtractionError({ code: error.code, message: error.message });
            toast({
                variant: 'destructive',
                title: 'Extraction failed',
                description: error.message,
            });
            onExtractionComplete?.({
                sourceUrl: cleanUrl,
                extractedAt: new Date().toISOString(),
                products: [],
                warnings: [],
                status: 'failed',
                error: error.message,
                errorCode: error.code,
            });
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
        }
    };

    const handleExport = (type) => {
        let completed = false;
        try {
            completed = type === 'CSV' ? exportCsv(rows, undefined, sourceUrl) : exportPdf(rows, sourceUrl);
        } catch {
            completed = false;
        }
        if (completed === false) {
            toast({
                variant: 'destructive',
                title: `${type} export blocked`,
                description:
                    type === 'PDF'
                        ? 'Allow popups for this site and try again.'
                        : 'The CSV file could not be created. Please try again.',
            });
            return;
        }
        toast({
            title: type === 'CSV' ? 'CSV downloaded' : 'Print-ready report opened',
            description:
                type === 'CSV'
                    ? 'The complete product data was exported.'
                    : 'Use the report’s Print / Save as PDF button when you are ready.',
        });
    };

    return (
        <>
            <section className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/60 sm:p-9">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Standards-based extraction
                </span>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    E-Commerce Product Data Extraction
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                    Turn any supported store&apos;s product page into clean, structured data. Paste a URL and DataFlow
                    pulls product names, prices, and more — ready to export to CSV or PDF.
                </p>

                <form
                    className="mt-7 flex flex-col gap-3 sm:flex-row"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!isExtracting) handleExtract();
                    }}
                >
                    <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="url"
                            value={url}
                            onChange={handleUrlChange}
                            disabled={isExtracting}
                            maxLength={2048}
                            placeholder="https://example-store.com/products/example-item"
                            aria-label="Product URL"
                            className="h-12 rounded-xl pl-10 text-base"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isExtracting || url.trim().length === 0}
                        className="h-12 gap-2 rounded-xl px-6 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
                    >
                        {isExtracting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Extracting...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" /> Extracted
                            </>
                        ) : (
                            <>
                                Extract Data <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </Button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                    Supports public product pages with JSON-LD, Open Graph, or recognizable product markup.
                </p>
            </section>

            <div className="mt-8">
                <ResultsPanel
                    status={status}
                    rows={rows}
                    sourceUrl={sourceUrl}
                    warnings={warnings}
                    error={extractionError}
                    onExport={handleExport}
                />
            </div>
        </>
    );
};

export default DashboardView;

import React, { useState } from 'react';
import { Sparkles, Link2, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import ResultsPanel from '@/components/ResultsPanel';
import { exportCsv, exportPdf } from '@/lib/dataflow';

const SAMPLE_ROWS = [
    { name: 'Wireless Mouse', price: '$24.99' },
    { name: 'Mechanical Keyboard', price: '$89.99' },
    { name: 'USB-C Hub', price: '$39.99' },
    { name: 'Laptop Stand', price: '$54.00' },
    { name: 'Noise-Cancelling Headphones', price: '$149.99' },
];

const isValidUrl = (value) => {
    try {
        const u = new URL(value.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const DashboardView = ({ toast, onExtractionComplete, viewJob, onClearViewedJob }) => {
    const [url, setUrl] = useState(viewJob ? viewJob.url : '');
    const [status, setStatus] = useState(viewJob ? 'success' : 'idle');
    const [rows, setRows] = useState(viewJob ? viewJob.rows : []);
    const [sourceUrl, setSourceUrl] = useState(viewJob ? viewJob.url : '');

    const isExtracting = status === 'loading';

    const handleExtract = () => {
        onClearViewedJob?.();
        if (!isValidUrl(url)) {
            setStatus('error');
            setRows([]);
            toast({
                variant: 'destructive',
                title: 'Invalid URL',
                description: 'Please enter a valid product URL starting with http:// or https://',
            });
            return;
        }

        setStatus('loading');
        setRows([]);
        const cleanUrl = url.trim();
        // Simulate occasional failures for realistic history statuses
        const willFail = /fail|error/i.test(cleanUrl);

        setTimeout(() => {
            if (willFail) {
                setStatus('error');
                toast({
                    variant: 'destructive',
                    title: 'Extraction failed',
                    description: 'We could not extract product data from that page.',
                });
                onExtractionComplete?.({ url: cleanUrl, rows: [], status: 'Failed', count: 0 });
                return;
            }
            const count = 3 + Math.floor(Math.random() * (SAMPLE_ROWS.length - 2));
            const resultRows = SAMPLE_ROWS.slice(0, count);
            setRows(resultRows);
            setSourceUrl(cleanUrl);
            setStatus('success');
            toast({
                title: 'Extraction complete',
                description: `${resultRows.length} products extracted successfully.`,
            });
            onExtractionComplete?.({
                url: cleanUrl,
                rows: resultRows,
                status: 'Success',
                count: resultRows.length,
            });
        }, 1600);
    };

    const handleExport = (type) => {
        if (type === 'CSV') exportCsv(rows);
        else exportPdf(rows, sourceUrl);
        toast({ title: `${type} export ready`, description: `Your ${type} file has been generated.` });
    };

    return (
        <>
            <section className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/60 sm:p-9">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> AI-powered extraction
                </span>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    E-Commerce Product Data Extraction
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                    Turn any supported store&apos;s product page into clean, structured data. Paste a URL and DataFlow
                    pulls product names, prices, and more — ready to export to CSV or PDF.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                if (status === 'error') setStatus('idle');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && !isExtracting && handleExtract()}
                            disabled={isExtracting}
                            placeholder="https://example-store.com/products"
                            aria-label="Product URL"
                            className="h-12 rounded-xl pl-10 text-base"
                        />
                    </div>
                    <Button
                        onClick={handleExtract}
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
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                    Supported: Shopify, WooCommerce, Magento, BigCommerce, and most standard catalogs.
                </p>
            </section>

            <div className="mt-8">
                <ResultsPanel status={status} rows={rows} sourceUrl={sourceUrl} onExport={handleExport} />
            </div>
        </>
    );
};

export default DashboardView;

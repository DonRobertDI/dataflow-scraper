import React, { useEffect, useState } from 'react';
import {
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    PackageSearch,
    TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatProductPrice } from '@/lib/dataflow';

const SkeletonRow = () => (
    <tr className="border-b border-border/60">
        <td className="px-5 py-4"><div className="h-10 w-56 animate-pulse rounded bg-muted" /></td>
        <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
        <td className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
        <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
    </tr>
);

const StatePanel = ({ icon: Icon, iconClass, title, description, role }) => (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role={role}>
        <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconClass}`}>
            <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
);

const errorTitles = {
    invalid_url: 'Invalid URL',
    invalid_request: 'Invalid request',
    website_blocked: 'Website blocked access',
    timeout: 'Extraction timed out',
    no_product_metadata: 'No product data found',
    navigation_failed: 'Page could not be reached',
    service_unavailable: 'Extraction service unavailable',
    internal_error: 'Extraction service error',
};

const ProductCell = ({ row }) => {
    const [imageFailed, setImageFailed] = useState(false);
    useEffect(() => setImageFailed(false), [row.imageUrl]);

    return (
    <div className="flex min-w-[18rem] items-start gap-3">
        {row.imageUrl && !imageFailed ? (
            <img
                src={row.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                title={row.imageUrl}
                className="h-12 w-12 shrink-0 rounded-lg border border-border bg-secondary object-cover"
                onError={() => setImageFailed(true)}
            />
        ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
                <PackageSearch className="h-5 w-5" />
            </span>
        )}
        <div className="min-w-0">
            <p className="font-medium text-foreground">{row.name}</p>
            {row.description ? (
                <details className="mt-1 max-w-md text-xs font-normal text-muted-foreground">
                    <summary className="cursor-pointer truncate hover:text-foreground" title={row.description}>
                        {row.description}
                    </summary>
                    <p className="mt-2 whitespace-normal leading-relaxed">{row.description}</p>
                </details>
            ) : (
                <p className="mt-1 text-xs font-normal text-muted-foreground">No description provided</p>
            )}
        </div>
    </div>
    );
};

const ResultsPanel = ({ status, rows, sourceUrl, warnings = [], error, onExport }) => {
    const hasData = status === 'success' && rows.length > 0;

    return (
        <section
            className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm shadow-theme"
            aria-live="polite"
            aria-busy={status === 'loading'}
        >
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        Extracted Products
                        {hasData && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2 py-0.5 text-xs font-medium text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {rows.length} {rows.length === 1 ? 'item' : 'items'}
                            </span>
                        )}
                    </h2>
                    {hasData ? (
                        <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-primary hover:underline"
                            title={sourceUrl}
                        >
                            {sourceUrl}
                        </a>
                    ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">Results will appear here after extraction</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" disabled={!hasData} onClick={() => onExport('CSV')} className="gap-1.5">
                        <FileSpreadsheet className="h-4 w-4" /> Export CSV
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!hasData}
                        onClick={() => onExport('PDF')}
                        className="gap-1.5"
                    >
                        <FileText className="h-4 w-4" /> Print / Save PDF
                    </Button>
                </div>
            </div>

            {status === 'idle' && (
                <StatePanel
                    icon={PackageSearch}
                    iconClass="bg-secondary text-muted-foreground"
                    title="No data yet"
                    description="Paste an individual public product-detail URL above and run an extraction."
                />
            )}

            {status === 'error' && (
                <StatePanel
                    icon={TriangleAlert}
                    iconClass="bg-destructive/10 text-destructive"
                    title={errorTitles[error?.code] || 'Extraction failed'}
                    description={error?.message || 'Verify the product URL and try again.'}
                    role="alert"
                />
            )}

            {status === 'success' && !hasData && (
                <StatePanel
                    icon={TriangleAlert}
                    iconClass="bg-destructive/10 text-destructive"
                    title="No product records returned"
                    description="The page completed without a usable product record. Try an individual product-detail URL."
                    role="alert"
                />
            )}

            {(status === 'loading' || hasData) && (
                <>
                    {hasData && warnings.length > 0 && (
                        <div className="flex gap-2 border-b border-warning-border bg-warning-surface px-5 py-3 text-sm text-warning" role="alert">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <ul className="list-disc space-y-0.5 pl-4">
                                {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                            </ul>
                        </div>
                    )}
                    <div className="max-h-[30rem] overflow-auto rounded-b-2xl">
                        <table className="w-full min-w-[860px] border-collapse text-sm">
                            <caption className="sr-only">Extracted product records</caption>
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-secondary/95 backdrop-blur">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Availability</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU / ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {status === 'loading'
                                    ? Array.from({ length: 3 }).map((_, index) => <SkeletonRow key={index} />)
                                    : rows.map((row, index) => (
                                          <tr
                                              key={`${row.sku || row.name}-${row.price || ''}-${index}`}
                                              className={`border-b border-border/50 transition-colors hover:bg-accent/60 ${
                                                  index % 2 === 1 ? 'bg-secondary/40' : 'bg-card'
                                              }`}
                                          >
                                              <td className="px-5 py-4"><ProductCell row={row} /></td>
                                              <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums text-foreground">
                                                  {formatProductPrice(row)}
                                              </td>
                                              <td className="px-5 py-4 text-muted-foreground">{row.availability || 'Not provided'}</td>
                                              <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{row.sku || 'Not provided'}</td>
                                          </tr>
                                      ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
};

export default ResultsPanel;

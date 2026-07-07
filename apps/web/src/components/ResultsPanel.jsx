import React from 'react';
import { FileSpreadsheet, FileText, PackageSearch, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SkeletonRow = () => (
    <tr className="border-b border-border/60">
        <td className="px-5 py-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </td>
        <td className="px-5 py-4 text-right">
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
        </td>
    </tr>
);

const StatePanel = ({ icon: Icon, iconClass, title, description }) => (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconClass}`}>
            <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
);

const ResultsPanel = ({ status, rows, sourceUrl, onExport }) => {
    const hasData = status === 'success' && rows.length > 0;

    return (
        <section className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm shadow-slate-200/60">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        Extracted Products
                        {hasData && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {rows.length} items
                            </span>
                        )}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {hasData ? sourceUrl : 'Results will appear here after extraction'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        disabled={!hasData}
                        onClick={() => onExport('CSV')}
                        className="gap-1.5"
                    >
                        <FileSpreadsheet className="h-4 w-4" /> Export CSV
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!hasData}
                        onClick={() => onExport('PDF')}
                        className="gap-1.5"
                    >
                        <FileText className="h-4 w-4" /> Export PDF
                    </Button>
                </div>
            </div>

            {status === 'idle' && (
                <StatePanel
                    icon={PackageSearch}
                    iconClass="bg-secondary text-muted-foreground"
                    title="No data yet"
                    description="Paste an e-commerce product URL above and run an extraction to see structured product data here."
                />
            )}

            {status === 'error' && (
                <StatePanel
                    icon={TriangleAlert}
                    iconClass="bg-destructive/10 text-destructive"
                    title="Invalid or unsupported URL"
                    description="We couldn't extract data from that link. Enter a valid product URL from a supported store, e.g. https://example-store.com/products."
                />
            )}

            {(status === 'loading' || hasData) && (
                <div className="max-h-[26rem] overflow-auto rounded-b-2xl">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-secondary/90 backdrop-blur">
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Product Name
                                </th>
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Price
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {status === 'loading'
                                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                                : rows.map((row, i) => (
                                      <tr
                                          key={row.name}
                                          className={`border-b border-border/50 transition-colors hover:bg-accent/60 ${
                                              i % 2 === 1 ? 'bg-secondary/40' : 'bg-card'
                                          }`}
                                      >
                                          <td className="px-5 py-4 font-medium text-foreground">{row.name}</td>
                                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
                                              {row.price}
                                          </td>
                                      </tr>
                                  ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default ResultsPanel;

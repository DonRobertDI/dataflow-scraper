import React, { useEffect, useMemo, useState } from 'react';
import {
    Search,
    Eye,
    FileSpreadsheet,
    FileText,
    Trash2,
    Inbox,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { exportCsv, exportPdf, formatDateTime } from '@/lib/dataflow';

const PAGE_SIZE = 10;
const FILTERS = ['All', 'success', 'failed'];

const StatusPill = ({ status }) => {
    const success = status === 'success';
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                success ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'
            }`}
        >
            {success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {success ? 'Success' : 'Failed'}
        </span>
    );
};

const IconAction = ({ label, onClick, disabled, children, tone }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={label}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 ${
            tone === 'danger' ? 'hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive' : 'hover:text-foreground'
        }`}
    >
        {children}
    </button>
);

const HistoryView = ({ history, onDelete, onView, toast }) => {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('All');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        let list = [...history].sort((a, b) => b.createdAt - a.createdAt);
        if (filter !== 'All') list = list.filter((r) => r.status === filter);
        const q = query.trim().toLowerCase();
        if (q) list = list.filter((r) => r.sourceUrl.toLowerCase().includes(q));
        return list;
    }, [history, filter, query]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        setPage((value) => Math.min(Math.max(1, value), totalPages));
    }, [totalPages]);

    const handleDelete = (id) => {
        if (onDelete(id) !== false) {
            toast({ title: 'Entry removed', description: 'The extraction was deleted from your history.' });
        }
    };

    const handleExport = (record, type) => {
        let completed = false;
        try {
            completed =
                type === 'CSV'
                    ? exportCsv(record.products, undefined, record.sourceUrl)
                    : exportPdf(record.products, record.sourceUrl);
        } catch {
            completed = false;
        }
        if (!completed) {
            toast({
                variant: 'destructive',
                title: `${type} export blocked`,
                description:
                    type === 'PDF'
                        ? 'Allow popups for this site and try again.'
                    : 'The file could not be created. Please try again.',
            });
        } else {
            toast({
                title: type === 'CSV' ? 'CSV downloaded' : 'Print-ready report opened',
                description:
                    type === 'CSV'
                        ? 'The complete product data was exported.'
                        : 'Use the report’s Print / Save as PDF button when you are ready.',
            });
        }
    };

    if (history.length === 0) {
        return (
            <section className="animate-fade-in-up rounded-2xl border border-border bg-card px-6 py-20 text-center shadow-sm shadow-slate-200/60">
                <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary text-muted-foreground">
                    <Inbox className="h-10 w-10" strokeWidth={1.6} />
                </span>
                <h2 className="text-lg font-semibold text-foreground">No extraction history yet.</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    Run your first extraction from the Dashboard. Successful results and useful failure details will
                    appear here for review.
                </p>
            </section>
        );
    }

    return (
        <section className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm shadow-slate-200/60">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-foreground">Extraction History</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by URL"
                            aria-label="Search extraction history by URL"
                            className="h-9 w-full pl-9 sm:w-56"
                        />
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1" role="group" aria-label="Filter extraction history">
                        {FILTERS.map((f) => (
                            <button
                                type="button"
                                key={f}
                                aria-pressed={filter === f}
                                onClick={() => {
                                    setFilter(f);
                                    setPage(1);
                                }}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                    filter === f
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {f === 'All' ? f : `${f[0].toUpperCase()}${f.slice(1)}`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                    <caption className="sr-only">Saved extraction jobs</caption>
                    <thead>
                        <tr className="bg-secondary/70">
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website URL</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Products</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date &amp; Time</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((r, i) => (
                            <tr
                                key={r.id}
                                className={`border-b border-border/50 transition-colors hover:bg-accent/50 ${
                                    i % 2 === 1 ? 'bg-secondary/30' : 'bg-card'
                                }`}
                            >
                                <td className="max-w-[280px] px-5 py-4 font-medium text-foreground">
                                    <p className="truncate" title={r.sourceUrl}>{r.sourceUrl}</p>
                                    {r.status === 'failed' && r.error && (
                                        <p className="mt-1 truncate text-xs font-normal text-destructive" title={r.error}>
                                            {r.error}
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-4 tabular-nums text-muted-foreground">{r.products.length}</td>
                                <td className="px-5 py-4 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                                <td className="px-5 py-4"><StatusPill status={r.status} /></td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <IconAction label="View details" onClick={() => onView(r)}>
                                            <Eye className="h-4 w-4" />
                                        </IconAction>
                                        <IconAction label="Export CSV" disabled={r.status !== 'success'} onClick={() => handleExport(r, 'CSV')}>
                                            <FileSpreadsheet className="h-4 w-4" />
                                        </IconAction>
                                        <IconAction label="Print / Save PDF" disabled={r.status !== 'success'} onClick={() => handleExport(r, 'PDF')}>
                                            <FileText className="h-4 w-4" />
                                        </IconAction>
                                        <IconAction label="Delete" tone="danger" onClick={() => handleDelete(r.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </IconAction>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {pageItems.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                                    No records match your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={currentPage <= 1}
                            onClick={() => setPage(Math.max(1, currentPage - 1))}
                            className="gap-1"
                        >
                            <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={currentPage >= totalPages}
                            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                            className="gap-1"
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default HistoryView;

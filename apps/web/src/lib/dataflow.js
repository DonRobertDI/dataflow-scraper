const STORAGE_KEY = 'dataflow.history.v1';

export const loadHistory = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveHistory = (items) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* ignore quota errors */
    }
};

export const addHistoryEntry = (entry) => {
    const items = loadHistory();
    const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        ...entry,
    };
    const next = [record, ...items];
    saveHistory(next);
    return next;
};

export const deleteHistoryEntry = (id) => {
    const next = loadHistory().filter((r) => r.id !== id);
    saveHistory(next);
    return next;
};

export const exportCsv = (rows, filename = 'dataflow-products.csv') => {
    const csv = ['Product Name,Price', ...rows.map((r) => `"${r.name}","${r.price}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const exportPdf = (rows, sourceUrl = '') => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
        <html><head><title>DataFlow Export</title>
        <style>body{font-family:Inter,sans-serif;padding:40px;color:#0f172a}
        h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0}
        th{font-size:12px;text-transform:uppercase;color:#64748b}</style></head>
        <body><h1>DataFlow — Extracted Products</h1><p>${sourceUrl}</p>
        <table><thead><tr><th>Product Name</th><th>Price</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${r.name}</td><td>${r.price}</td></tr>`).join('')}
        </tbody></table></body></html>`);
    win.document.close();
    win.print();
};

export const formatDateTime = (ts) =>
    new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const STORAGE_KEY = 'dataflow.history.v2';
const MAX_HISTORY_ITEMS = 100;

const isSafeHttpUrl = (value) => {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (host === 'localhost' || host.endsWith('.localhost') || host === '::' || host === '::1') return false;
        if (/^(?:127\.|10\.|0\.|192\.168\.|169\.254\.)/.test(host)) return false;
        if (/^(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/i.test(host)) return false;
        if (/^::ffff:(?:127\.|10\.|192\.168\.|169\.254\.)/i.test(host)) return false;
        const sharedOrPrivate = host.match(/^(172|100)\.(\d{1,3})\./);
        if (sharedOrPrivate) {
            const first = sharedOrPrivate[1];
            const second = Number(sharedOrPrivate[2]);
            if ((first === '172' && second >= 16 && second <= 31) || (first === '100' && second >= 64 && second <= 127)) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
};

const normalizeProduct = (product) => {
    if (!product || typeof product !== 'object' || typeof product.name !== 'string' || !product.name.trim()) {
        return null;
    }
    const optional = (field) => (typeof product[field] === 'string' ? product[field] : null);
    const imageUrl = optional('imageUrl');
    return {
        name: product.name.trim(),
        price: optional('price'),
        currency: optional('currency'),
        availability: optional('availability'),
        sku: optional('sku'),
        description: optional('description'),
        imageUrl: imageUrl && isSafeHttpUrl(imageUrl) ? imageUrl : null,
    };
};

const normalizeHistoryEntry = (entry) => {
    if (!entry || typeof entry !== 'object' || !['success', 'failed'].includes(entry.status)) return null;
    if (typeof entry.sourceUrl !== 'string' || !isSafeHttpUrl(entry.sourceUrl)) return null;
    if (!Array.isArray(entry.products) || !Number.isFinite(entry.createdAt)) return null;
    const products = entry.products.map(normalizeProduct).filter(Boolean);
    if (entry.status === 'success' && products.length === 0) return null;

    return {
        id: typeof entry.id === 'string' && entry.id ? entry.id : `${entry.createdAt}-${entry.sourceUrl}`,
        createdAt: entry.createdAt,
        extractedAt: typeof entry.extractedAt === 'string' ? entry.extractedAt : null,
        pageTitle: typeof entry.pageTitle === 'string' ? entry.pageTitle : '',
        sourceUrl: entry.sourceUrl,
        duration: Number.isFinite(entry.duration) ? entry.duration : null,
        products,
        warnings: Array.isArray(entry.warnings)
            ? entry.warnings.filter((warning) => typeof warning === 'string')
            : [],
        status: entry.status,
        error:
            entry.status === 'failed'
                ? (typeof entry.error === 'string' && entry.error) || 'The extraction failed.'
                : null,
        errorCode:
            entry.status === 'failed' && typeof entry.errorCode === 'string'
                ? entry.errorCode
                : null,
    };
};

export const loadHistory = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.map(normalizeHistoryEntry).filter(Boolean).slice(0, MAX_HISTORY_ITEMS)
            : [];
    } catch {
        return [];
    }
};

export const saveHistory = (items) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
    } catch {
        return false;
    }
};

export const addHistoryEntry = (entry) => {
    const items = loadHistory();
    const extractedTime = entry.extractedAt ? new Date(entry.extractedAt).getTime() : Date.now();
    const record = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Number.isNaN(extractedTime) ? Date.now() : extractedTime,
    };
    const normalizedRecord = normalizeHistoryEntry(record);
    if (!normalizedRecord) return { items, persisted: false };
    const next = [normalizedRecord, ...items].slice(0, MAX_HISTORY_ITEMS);
    const persisted = saveHistory(next);
    return { items: persisted ? next : items, persisted };
};

export const deleteHistoryEntry = (id) => {
    const items = loadHistory();
    const next = items.filter((record) => record.id !== id);
    const persisted = saveHistory(next);
    return { items: persisted ? next : items, persisted };
};

export const formatProductPrice = (row) => {
    const price = row?.price ? String(row.price).trim() : '';
    const currency = row?.currency ? String(row.currency).trim().toUpperCase() : '';
    if (!price) return 'Not provided';
    if (!currency) return price;
    if (price.toUpperCase().includes(currency)) return price;
    const unambiguousSymbols = {
        EUR: '€',
        GBP: '£',
        INR: '₹',
        PHP: '₱',
        KRW: '₩',
        THB: '฿',
        VND: '₫',
        RUB: '₽',
        TRY: '₺',
    };
    if (unambiguousSymbols[currency] && price.includes(unambiguousSymbols[currency])) return price;
    const dollarPrefixes = {
        USD: /(?:^|\s)(?:US)?\$/,
        CAD: /(?:^|\s)(?:CA|C)\$/,
        AUD: /(?:^|\s)(?:AU|A)\$/,
        NZD: /(?:^|\s)NZ\$/,
        HKD: /(?:^|\s)HK\$/,
        SGD: /(?:^|\s)S\$/,
    };
    if (dollarPrefixes[currency]?.test(price)) return price;
    return `${price} ${currency}`;
};

export const csvCell = (value) => {
    const text = value == null ? '' : String(value);
    const spreadsheetSafe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
};

export const exportCsv = (rows, filename = 'dataflow-products.csv', sourceUrl = '') => {
    const headers = [
        'Product Name',
        'Price',
        'Currency',
        'Availability',
        'SKU / ID',
        'Description',
        'Image URL',
        'Source URL',
    ];
    const records = rows.map((row) => [
        row.name,
        row.price,
        row.currency,
        row.availability,
        row.sku,
        row.description,
        row.imageUrl,
        sourceUrl,
    ]);
    const csv = [headers, ...records].map((record) => record.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
};

const escapeHtml = (value) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

export const exportPdf = (rows, sourceUrl = '') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;
    printWindow.document.write(`
        <!doctype html><html><head><title>DataFlow Export</title>
        <style>body{font-family:Inter,sans-serif;padding:40px;color:#0f172a}
        @page{size:landscape;margin:12mm}body{padding:0}h1{font-size:20px}p{overflow-wrap:anywhere}
        button{border:0;border-radius:8px;background:#0f172a;color:white;padding:10px 14px;font-weight:600;cursor:pointer}
        table{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:16px}
        th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e2e8f0}
        th{font-size:11px;text-transform:uppercase;color:#64748b}
        td{font-size:12px;overflow-wrap:anywhere}.description{max-width:260px}
        @media print{button,.print-hint{display:none}}</style></head>
        <body><h1>DataFlow - Extracted Products</h1><p>${escapeHtml(sourceUrl)}</p>
        <button type="button" onclick="window.print()">Print / Save as PDF</button>
        <span class="print-hint"> Use your browser's print destination to save this report as a PDF.</span>
        <table><thead><tr><th>Product Name</th><th>Price</th><th>Availability</th><th>SKU / ID</th><th>Description</th><th>Image URL</th></tr></thead><tbody>
        ${rows
            .map(
                (row) =>
                    `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(
                        formatProductPrice(row),
                    )}</td><td>${escapeHtml(row.availability || 'Not provided')}</td><td>${escapeHtml(
                        row.sku || 'Not provided',
                    )}</td><td class="description">${escapeHtml(
                        row.description || 'Not provided',
                    )}</td><td>${escapeHtml(row.imageUrl || 'Not provided')}</td></tr>`,
            )
            .join('')}
        </tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    return true;
};

export const formatDateTime = (timestamp) =>
    new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

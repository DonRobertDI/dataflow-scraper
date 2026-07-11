const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
    constructor(message, status = 0, code = 'request_failed') {
        super(message || 'The extraction could not be completed.');
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

const validationMessage = (detail) => {
    if (!Array.isArray(detail)) return null;
    const messages = detail
        .map((item) => (typeof item?.msg === 'string' ? item.msg : item?.message))
        .filter((message) => typeof message === 'string' && message.trim());
    return messages.length > 0 ? messages.join(' ') : null;
};

export const parseApiError = (payload, status = 0) => {
    const detail = payload?.detail;
    if (Array.isArray(detail)) {
        return new ApiError(
            validationMessage(detail) || 'The request is invalid.',
            status,
            'invalid_request',
        );
    }
    if (detail && typeof detail === 'object') {
        return new ApiError(
            typeof detail.message === 'string' ? detail.message : 'The extraction could not be completed.',
            status,
            typeof detail.code === 'string' ? detail.code : 'request_failed',
        );
    }
    if (typeof detail === 'string' && detail.trim()) {
        return new ApiError(detail, status);
    }
    return new ApiError('The extraction could not be completed.', status);
};

const optionalString = (value) => value == null || typeof value === 'string';

const isProduct = (product) =>
    product &&
    typeof product === 'object' &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    ['price', 'currency', 'availability', 'sku', 'imageUrl', 'description'].every((field) =>
        optionalString(product[field]),
    );

const normalizeResponse = (payload, status) => {
    if (!payload || typeof payload !== 'object') {
        throw new ApiError('The extraction service returned an invalid response.', status);
    }
    if (!Array.isArray(payload.products) || payload.products.length === 0) {
        throw new ApiError(
            'No product records were returned for this page.',
            status,
            'no_product_metadata',
        );
    }
    if (!payload.products.every(isProduct)) {
        throw new ApiError('The extraction response contained an invalid product record.', status);
    }
    if (typeof payload.sourceUrl !== 'string' || !payload.sourceUrl.trim()) {
        throw new ApiError('The extraction response did not include a valid source URL.', status);
    }
    try {
        const source = new URL(payload.sourceUrl);
        if (!['http:', 'https:'].includes(source.protocol)) throw new Error('invalid protocol');
    } catch {
        throw new ApiError('The extraction response included an unsafe source URL.', status);
    }
    if (payload.status !== 'success') {
        throw new ApiError('The extraction response included an invalid status.', status);
    }

    return {
        ...payload,
        warnings: Array.isArray(payload.warnings)
            ? payload.warnings.filter((warning) => typeof warning === 'string' && warning.trim())
            : [],
    };
};

export const scrapeUrl = async (url, { signal } = {}) => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (signal?.aborted) controller.abort();

    try {
        const response = await fetch(`${API_BASE_URL}/api/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new ApiError('The extraction service returned an invalid response.', response.status);
        }
        if (!response.ok) throw parseApiError(payload, response.status);
        return normalizeResponse(payload, response.status);
    } catch (error) {
        if (error?.name === 'AbortError') {
            if (timedOut) {
                throw new ApiError('The request timed out. Please try again.', 504, 'timeout');
            }
            throw new ApiError('The extraction was cancelled.', 0, 'cancelled');
        }
        if (error instanceof ApiError) throw error;
        throw new ApiError('Unable to reach the extraction service. Check that the backend is running.');
    } finally {
        globalThis.clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortFromCaller);
    }
};

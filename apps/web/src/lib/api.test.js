import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError, parseApiError, scrapeUrl } from './api.js';


test('parses FastAPI validation arrays into a useful error', () => {
    const error = parseApiError(
        { detail: [{ msg: 'URL is too long' }, { msg: 'URL is invalid' }] },
        422,
    );
    assert.equal(error.code, 'invalid_request');
    assert.equal(error.status, 422);
    assert.equal(error.message, 'URL is too long URL is invalid');
});

test('parses the standard API error object', () => {
    const error = parseApiError(
        { detail: { code: 'website_blocked', message: 'Access denied' } },
        403,
    );
    assert.equal(error.code, 'website_blocked');
    assert.equal(error.message, 'Access denied');
});

test('rejects an empty success response instead of rendering a blank state', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ sourceUrl: 'https://example.com/product/1', products: [] }),
    });

    await assert.rejects(
        scrapeUrl('https://example.com/product/1'),
        (error) => error instanceof ApiError && error.code === 'no_product_metadata',
    );
});

test('accepts and normalizes a complete success response', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            status: 'success',
            sourceUrl: 'https://example.com/product/1',
            products: [{ name: 'Fixture', price: '10.00', currency: 'USD' }],
        }),
    });

    const result = await scrapeUrl('https://example.com/product/1');
    assert.equal(result.products[0].name, 'Fixture');
    assert.deepEqual(result.warnings, []);
});

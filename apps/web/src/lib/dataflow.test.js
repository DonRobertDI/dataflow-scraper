import assert from 'node:assert/strict';
import test from 'node:test';

import {
    addHistoryEntry,
    csvCell,
    formatProductPrice,
    loadHistory,
    saveHistory,
} from './dataflow.js';


const installStorage = (initial = null, failWrites = false) => {
    const values = new Map();
    if (initial) values.set('dataflow.history.v2', JSON.stringify(initial));
    globalThis.localStorage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            if (failWrites) throw new Error('quota exceeded');
            values.set(key, value);
        },
    };
};


test('formats currency without duplicating an existing symbol or code', () => {
    assert.equal(formatProductPrice({ price: '9.99', currency: 'USD' }), '9.99 USD');
    assert.equal(formatProductPrice({ price: '$9.99', currency: 'USD' }), '$9.99');
    assert.equal(formatProductPrice({ price: '$9.99', currency: 'CAD' }), '$9.99 CAD');
    assert.equal(formatProductPrice({ price: 'C$9.99', currency: 'CAD' }), 'C$9.99');
    assert.equal(formatProductPrice({ price: '9.99 USD', currency: 'USD' }), '9.99 USD');
    assert.equal(formatProductPrice({}), 'Not provided');
});

test('CSV cells neutralize formulas after leading whitespace and controls', () => {
    assert.equal(csvCell('\t=cmd|calc'), '"\'\t=cmd|calc"');
    assert.equal(csvCell('  +SUM(1,1)'), '"\'  +SUM(1,1)"');
    assert.equal(csvCell('ordinary text'), '"ordinary text"');
});

test('history rejects malformed records and remains capped', () => {
    const records = Array.from({ length: 105 }, (_, index) => ({
        id: String(index),
        createdAt: Date.now() - index,
        sourceUrl: `https://example.com/products/${index}`,
        products: [{ name: `Product ${index}` }],
        status: 'success',
    }));
    records.push({ sourceUrl: 'bad', products: [], status: 'unknown' });
    installStorage(records);
    assert.equal(loadHistory().length, 100);
});

test('history reports storage failures without claiming the record was saved', () => {
    installStorage([], true);
    const result = addHistoryEntry({
        sourceUrl: 'https://example.com/products/1',
        extractedAt: new Date().toISOString(),
        products: [{ name: 'Fixture' }],
        status: 'success',
    });
    assert.equal(result.persisted, false);
    assert.deepEqual(result.items, []);
    assert.equal(saveHistory([]), false);
});

test('history normalizes corrupted optional fields before React can render them', () => {
    installStorage([
        {
            id: 'failed-1',
            createdAt: Date.now(),
            sourceUrl: 'https://example.com/products/1',
            products: [{ name: 'Fixture', availability: {}, description: [], imageUrl: 'javascript:alert(1)' }],
            warnings: [{ bad: true }, 'Useful warning'],
            status: 'failed',
            error: { bad: true },
        },
    ]);
    const [record] = loadHistory();
    assert.equal(record.error, 'The extraction failed.');
    assert.equal(record.products[0].availability, null);
    assert.equal(record.products[0].description, null);
    assert.equal(record.products[0].imageUrl, null);
    assert.deepEqual(record.warnings, ['Useful warning']);
});

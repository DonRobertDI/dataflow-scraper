import React from 'react';
import { Rocket, Globe, Download, HelpCircle, Activity, ClipboardPaste, MousePointerClick, FileSpreadsheet, FileText } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from './ui/accordion';

const supported = [
    { name: 'JSON-LD Product', note: 'Preferred structured source' },
    { name: 'Open Graph', note: 'Product metadata fallback' },
    { name: 'Schema markup', note: 'Name and price properties' },
    { name: 'Generic HTML', note: 'Conservative page fallback' },
];

const testPages = [
    { name: 'Web Scraping Product', url: 'https://web-scraping.dev/product/1' },
    { name: 'Books to Scrape', url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' },
    { name: 'Oxylabs Sandbox', url: 'https://sandbox.oxylabs.io/products/1' },
];

const faqs = [
    {
        q: 'What websites are supported?',
        a: 'DataFlow supports public product-detail pages that expose JSON-LD Product data, product metadata, or recognizable product markup. Catalog, search, login, and bot-challenge pages are intentionally not treated as a single product.',
    },
    {
        q: "Why isn't my URL working?",
        a: 'Make sure the URL starts with http:// or https:// and points to one individual public product page. Pages behind logins, region locks, or bot protection may not be extractable.',
    },
    {
        q: 'How long does extraction take?',
        a: 'Extraction time depends on the source page. Navigation is limited to 30 seconds, and the dashboard allows up to 60 seconds for browser startup, page settling, and normalization.',
    },
    {
        q: 'Can I export unlimited times?',
        a: 'Yes. Download CSV directly, or open a print-ready report and choose Print / Save as PDF. Both options remain available from the Dashboard and History.',
    },
];

const Section = ({ icon: Icon, title, children }) => (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-theme sm:p-7">
        <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {children}
    </section>
);

const Step = ({ icon: Icon, title, desc }) => (
    <div className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
    </div>
);

const DocumentationView = () => (
    <div className="animate-fade-in-up space-y-6">
        <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Documentation</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
                Everything you need to turn e-commerce pages into clean, structured product data.
            </p>
        </div>

        <Section icon={Rocket} title="Getting Started">
            <div className="space-y-4">
                <Step icon={ClipboardPaste} title="Paste a product-detail URL" desc="Open one public product page, copy its full address, and paste it into the Dashboard." />
                <Step icon={MousePointerClick} title="Run extraction" desc="Click Extract Data. DataFlow analyzes the page and pulls product names, prices, and more." />
                <Step icon={FileSpreadsheet} title="Review & export" desc="Inspect the structured results table, then export the data as CSV or PDF." />
            </div>
        </Section>

        <Section icon={Globe} title="Supported Websites">
            <div className="grid gap-3 sm:grid-cols-2">
                {supported.map((s) => (
                    <div key={s.name} className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.note}</span>
                    </div>
                ))}
            </div>
        </Section>

        <Section icon={Download} title="Export Options">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3 rounded-xl border border-border/70 p-4">
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                        <p className="text-sm font-medium text-foreground">CSV Export</p>
                        <p className="text-sm text-muted-foreground">Download a comma-separated file, ready for Excel, Google Sheets, or any data pipeline.</p>
                    </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-border/70 p-4">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                        <p className="text-sm font-medium text-foreground">PDF Export</p>
                        <p className="text-sm text-muted-foreground">Open a clean report, then use your browser&apos;s Print / Save as PDF option for sharing or archiving.</p>
                    </div>
                </div>
            </div>
        </Section>

        <Section icon={HelpCircle} title="Frequently Asked Questions">
            <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                    <AccordionItem key={i} value={`item-${i}`}>
                        <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </Section>

        <Section icon={Activity} title="Service Health">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                    Administrators can verify the extraction service at the backend /health endpoint.
                </span>
            </div>
            <div className="mt-5 border-t border-border pt-5">
                <p className="text-sm font-medium text-foreground">Authorized pages for testing</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    These public sandboxes are designed for scraper practice. Use individual detail links and respect the terms of any other site.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {testPages.map((page) => (
                        <a
                            key={page.url}
                            href={page.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-primary hover:bg-accent"
                        >
                            {page.name}
                        </a>
                    ))}
                </div>
            </div>
        </Section>
    </div>
);

export default DocumentationView;

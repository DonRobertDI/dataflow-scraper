import React from 'react';
import { Rocket, Globe, Download, HelpCircle, Activity, ClipboardPaste, MousePointerClick, FileSpreadsheet, FileText } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from './ui/accordion';

const supported = [
    { name: 'Shopify', note: 'Product & collection pages' },
    { name: 'WooCommerce', note: 'WordPress storefronts' },
    { name: 'Magento', note: 'Adobe Commerce catalogs' },
    { name: 'BigCommerce', note: 'Hosted store pages' },
];

const faqs = [
    {
        q: 'What websites are supported?',
        a: 'DataFlow supports Shopify, WooCommerce, Magento, BigCommerce, and most standard product catalog pages that expose structured product markup.',
    },
    {
        q: "Why isn't my URL working?",
        a: 'Make sure the URL starts with http:// or https:// and points to a public product or catalog page. Pages behind logins, region locks, or heavy bot protection may not be extractable.',
    },
    {
        q: 'How long does extraction take?',
        a: 'Most extractions complete in one to three seconds. Larger catalog pages with many products may take slightly longer.',
    },
    {
        q: 'Can I export unlimited times?',
        a: 'Yes. Every successful extraction can be exported to CSV or PDF as many times as you like, both from the Dashboard and your History.',
    },
];

const Section = ({ icon: Icon, title, children }) => (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm shadow-slate-200/60 sm:p-7">
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
                <Step icon={ClipboardPaste} title="Paste an e-commerce URL" desc="Copy the address of a product or catalog page and paste it into the input field on the Dashboard." />
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
                        <p className="text-sm text-muted-foreground">Generate a clean, printable report of the extracted products for sharing or archiving.</p>
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

        <Section icon={Activity} title="API Status">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-emerald-700">Extraction Service Online</span>
            </div>
        </Section>
    </div>
);

export default DocumentationView;

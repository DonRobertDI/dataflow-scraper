import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';    
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';
import DocumentationView from '@/components/DocumentationView';
import { loadHistory, addHistoryEntry, deleteHistoryEntry } from '@/lib/dataflow';

const transition = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.25, ease: 'easeOut' },
};

const HomePage = () => {
    const [view, setView] = useState('dashboard');
    const [history, setHistory] = useState([]);
    const [dashboardBadge, setDashboardBadge] = useState(false);
    const [viewedJob, setViewedJob] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    const handleNavigate = (next) => {
        if (next === 'dashboard') setDashboardBadge(false);
        setView(next);
    };

    const handleExtractionComplete = (entry) => {
        setHistory(addHistoryEntry(entry));
        if (entry.status === 'Success') setDashboardBadge(true);
    };

    const handleDelete = (id) => setHistory(deleteHistoryEntry(id));

    const handleView = (job) => {
        setViewedJob(job);
        setDashboardBadge(false);
        setView('dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background">
            <Header
                view={view}
                onNavigate={handleNavigate}
                historyCount={history.length}
                dashboardBadge={dashboardBadge}
            />

            <main className="mx-auto max-w-[64rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                <AnimatePresence mode="wait">
                    <motion.div key={view} {...transition}>
                        {view === 'dashboard' && (
                            <DashboardView
                                toast={toast}
                                onExtractionComplete={handleExtractionComplete}
                                viewJob={viewedJob}
                                onClearViewedJob={() => setViewedJob(null)}
                            />
                        )}
                        {view === 'history' && (
                            <HistoryView
                                history={history}
                                onDelete={handleDelete}
                                onView={handleView}
                                toast={toast}
                            />
                        )}
                        {view === 'documentation' && <DocumentationView />}
                    </motion.div>
                </AnimatePresence>
            </main>

            <footer className="mx-auto max-w-[64rem] px-4 py-8 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
                DataFlow — E-Commerce Scraper · © {new Date().getFullYear()} DataFlow, Inc.
            </footer>

            <Toaster />
        </div>
    );
};

export default HomePage;
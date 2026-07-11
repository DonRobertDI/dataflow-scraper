import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';
import DocumentationView from '@/components/DocumentationView';
import { loadHistory, addHistoryEntry, deleteHistoryEntry } from '@/lib/dataflow';

const HomePage = () => {
    const [view, setView] = useState('dashboard');
    const [history, setHistory] = useState([]);
    const [viewedJob, setViewedJob] = useState(null);
    const [dashboardRevision, setDashboardRevision] = useState(0);
    const { toast } = useToast();

    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    const handleNavigate = (next) => {
        setView(next);
    };

    const handleExtractionComplete = (entry) => {
        const result = addHistoryEntry(entry);
        setHistory(result.items);
        if (!result.persisted) {
            toast({
                variant: 'destructive',
                title: 'History was not saved',
                description: 'Browser storage is unavailable or full. Your extraction result is still usable.',
            });
        }
    };

    const handleDelete = (id) => {
        const result = deleteHistoryEntry(id);
        setHistory(result.items);
        if (!result.persisted) {
            toast({
                variant: 'destructive',
                title: 'Could not update history',
                description: 'Browser storage is unavailable. The entry was not removed.',
            });
        } else if (viewedJob?.id === id) {
            setViewedJob(null);
            setDashboardRevision((revision) => revision + 1);
        }
        return result.persisted;
    };

    const handleView = (job) => {
        setViewedJob(job);
        setView('dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background">
            <Header
                view={view}
                onNavigate={handleNavigate}
                historyCount={history.length}
            />

            <main className="mx-auto max-w-[64rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
                <div hidden={view !== 'dashboard'}>
                    <DashboardView
                        key={dashboardRevision}
                        toast={toast}
                        onExtractionComplete={handleExtractionComplete}
                        viewJob={viewedJob}
                        onClearViewedJob={() => setViewedJob(null)}
                    />
                </div>
                <div hidden={view !== 'history'}>
                    <HistoryView
                        history={history}
                        onDelete={handleDelete}
                        onView={handleView}
                        toast={toast}
                    />
                </div>
                <div hidden={view !== 'documentation'}>
                    <DocumentationView />
                </div>
            </main>

            <footer className="mx-auto max-w-[64rem] px-4 py-8 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
                DataFlow — local product research workspace · {new Date().getFullYear()}
            </footer>

            <Toaster />
        </div>
    );
};

export default HomePage;

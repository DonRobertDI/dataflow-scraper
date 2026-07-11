import React, { useState } from 'react';
import { Boxes, LayoutDashboard, History, BookOpen, HardDrive, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

const navLinks = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'history', label: 'History', icon: History },
    { key: 'documentation', label: 'Documentation', icon: BookOpen },
];

const Badge = ({ children, tone = 'muted' }) => {
    const tones = {
        muted: 'bg-secondary text-muted-foreground',
        primary: 'bg-primary text-primary-foreground',
        dot: 'bg-success text-primary-foreground',
    };
    return (
        <span
            className={`ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.65rem] font-semibold leading-5 ${tones[tone]}`}
        >
            {children}
        </span>
    );
};

const Header = ({ view, onNavigate, historyCount = 0 }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    const renderBadge = (key) => {
        if (key === 'history' && historyCount > 0) {
            return <Badge tone={view === 'history' ? 'primary' : 'muted'}>{historyCount}</Badge>;
        }
        return null;
    };

    const go = (key) => {
        onNavigate(key);
        setMobileOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between px-4 sm:px-6 lg:px-8">
                <button onClick={() => go('dashboard')} className="flex items-center gap-2.5" aria-label="Open dashboard">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
                        <Boxes className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="text-lg font-bold tracking-tight text-foreground">DataFlow</span>
                </button>

                <nav className="hidden items-center gap-1 md:flex">
                    {navLinks.map(({ key, label, icon: Icon }) => {
                        const active = view === key;
                        return (
                            <button
                                key={key}
                                onClick={() => go(key)}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                                    active
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                            >
                                <Icon className="h-4 w-4" strokeWidth={2} />
                                {label}
                                {renderBadge(key)}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2">
                    <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                        <HardDrive className="h-3.5 w-3.5" /> Local history
                    </span>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Moon className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>

                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary md:hidden"
                        onClick={() => setMobileOpen((v) => !v)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-navigation"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <nav id="mobile-navigation" className="border-t border-border/70 bg-background px-4 py-3 md:hidden">
                    {navLinks.map(({ key, label, icon: Icon }) => {
                        const active = view === key;
                        return (
                            <button
                                key={key}
                                onClick={() => go(key)}
                                aria-current={active ? 'page' : undefined}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:bg-secondary'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                                {renderBadge(key)}
                            </button>
                        );
                    })}
                </nav>
            )}
        </header>
    );
};

export default Header;

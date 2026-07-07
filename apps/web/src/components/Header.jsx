import React, { useState } from 'react';
import { Boxes, LayoutDashboard, History, BookOpen, Menu, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navLinks = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'history', label: 'History', icon: History },
    { key: 'documentation', label: 'Documentation', icon: BookOpen },
];

const Badge = ({ children, tone = 'muted' }) => {
    const tones = {
        muted: 'bg-secondary text-muted-foreground',
        primary: 'bg-primary text-primary-foreground',
        dot: 'bg-emerald-500 text-white',
    };
    return (
        <span
            className={`ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.65rem] font-semibold leading-5 ${tones[tone]}`}
        >
            {children}
        </span>
    );
};

const Header = ({ view, onNavigate, historyCount = 0, dashboardBadge = false }) => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const renderBadge = (key) => {
        if (key === 'history' && historyCount > 0) {
            return <Badge tone={view === 'history' ? 'primary' : 'muted'}>{historyCount}</Badge>;
        }
        if (key === 'dashboard' && dashboardBadge) {
            return <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500" aria-hidden />;
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
                <button onClick={() => go('dashboard')} className="flex items-center gap-2.5">
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
                    <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <Avatar className="h-9 w-9 border border-border">
                                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                    AM
                                </AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">Alex Morgan</span>
                                <span className="text-xs font-normal text-muted-foreground">alex@dataflow.io</span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Account settings</DropdownMenuItem>
                            <DropdownMenuItem>API keys</DropdownMenuItem>
                            <DropdownMenuItem>Billing</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary md:hidden"
                        onClick={() => setMobileOpen((v) => !v)}
                        aria-label="Toggle navigation"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <nav className="border-t border-border/70 bg-background px-4 py-3 md:hidden">
                    {navLinks.map(({ key, label, icon: Icon }) => {
                        const active = view === key;
                        return (
                            <button
                                key={key}
                                onClick={() => go(key)}
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

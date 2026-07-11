import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'dataflow-theme';

const readTheme = () => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
};

export const useTheme = () => {
    const [theme, setTheme] = useState(readTheme);
    const transitionTimer = useRef(null);

    useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

    const toggleTheme = () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!reduceMotion) document.documentElement.classList.add('theme-transition');
        applyTheme(nextTheme);
        setTheme(nextTheme);

        try {
            window.localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch {
            // The selected theme still applies for this session when storage is unavailable.
        }

        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = window.setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 180);
    };

    return { theme, toggleTheme };
};

const USERS_KEY = 'dataflow.users.v1';
const SESSION_KEY = 'dataflow.session.v1';

const readUsers = () => {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeUsers = (users) => {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
        /* ignore */
    }
};

export const initialsFromName = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || 'U';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

export const registerUser = ({ name, email, password }) => {
    const users = readUsers();
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email === normalized)) {
        throw new Error('An account with this email already exists.');
    }
    const user = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        email: normalized,
        password,
    };
    writeUsers([...users, user]);
    return publicUser(user);
};

export const loginUser = ({ email, password }) => {
    const users = readUsers();
    const normalized = email.trim().toLowerCase();
    const user = users.find((u) => u.email === normalized);
    if (!user || user.password !== password) {
        throw new Error('Incorrect email or password.');
    }
    return publicUser(user);
};

export const changePassword = (userId, currentPassword, newPassword) => {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found.');
    if (users[idx].password !== currentPassword) {
        throw new Error('Current password is incorrect.');
    }
    users[idx] = { ...users[idx], password: newPassword };
    writeUsers(users);
};

export const saveSession = (user, remember) => {
    try {
        const store = remember ? localStorage : sessionStorage;
        store.setItem(SESSION_KEY, JSON.stringify(user));
        (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
};

export const loadSession = () => {
    try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const clearSession = () => {
    try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
};

export const passwordChecks = (pw = '') => ({
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
});

export const passwordStrength = (pw = '') => {
    const checks = passwordChecks(pw);
    return Object.values(checks).filter(Boolean).length;
};

export const isValidEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

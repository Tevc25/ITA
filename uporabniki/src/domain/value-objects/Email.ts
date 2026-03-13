export function normalizeEmail(raw: string): string {
    const email = raw.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
        throw new Error('Invalid email address');
    }
    return email;
}
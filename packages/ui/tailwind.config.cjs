/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{html,js,jsx,tsx,ts}'
    ],
    theme: {
        extend: {
            colors: {
                background: 'rgb(var(--background) / <alpha-value>)',
                foreground: 'rgb(var(--foreground) / <alpha-value>)',
                muted: 'rgb(var(--muted) / <alpha-value>)',
                'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
                card: 'rgb(var(--card) / <alpha-value>)',
                panel: 'rgb(var(--panel) / <alpha-value>)',
                border: 'rgb(var(--border) / <alpha-value>)',
                secondary: 'rgb(var(--secondary) / <alpha-value>)',
                accent: 'rgb(var(--accent) / <alpha-value>)'
            },
            boxShadow: {
                glow: '0 20px 70px rgba(14, 165, 233, 0.18)'
            }
        }
    }
};

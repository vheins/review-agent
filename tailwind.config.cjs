/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './electron/**/*.{html,js,cjs}'
    ],
    theme: {
        extend: {
            boxShadow: {
                glow: '0 20px 70px rgba(14, 165, 233, 0.18)'
            }
        }
    }
};

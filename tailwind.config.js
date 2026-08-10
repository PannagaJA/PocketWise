/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        card: '#FFFFFF',
        foreground: '#09090B',
        muted: '#71717A',
        'muted-bg': '#F4F4F5',
        border: '#E4E4E7',
        primary: {
          DEFAULT: '#09090B',
          foreground: '#FFFFFF',
        },
        income: {
          DEFAULT: '#10B981',
          bg: '#ECFDF5',
          border: '#A7F3D0',
        },
        expense: {
          DEFAULT: '#EF4444',
          bg: '#FEF2F2',
          border: '#FECACA',
        },
        subscription: {
          DEFAULT: '#6366F1',
          bg: '#EEF2FF',
          border: '#C7D2FE',
        },
        budget: {
          DEFAULT: '#F59E0B',
          bg: '#FFFBEB',
          border: '#FDE68A',
        }
      },
    },
  },
  plugins: [],
}

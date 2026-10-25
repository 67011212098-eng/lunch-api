/** @type {import('tailwindcss').Config} */
module.exports = {
  // template ของทุก component เขียนอยู่ในไฟล์ .ts จึงต้องสแกน .ts ด้วย
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0e9384', soft: '#e3f6f3' },
        line: '#d2eae6',
        mute: '#777',
        ink: '#222',
        bad: '#e03131',
        ok: '#2f9e44',
        page: '#f2fbf9',
      },
      fontFamily: {
        sans: ['Sarabun', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      // แถบ "คำนวณใหม่แล้ว" กะพริบสีเหลืองตอนขึ้นมาใหม่ ให้เห็นว่าแผนเปลี่ยน
      keyframes: {
        recalc: { from: { background: '#fff3bf', transform: 'scale(.98)' }, to: { background: '#e3f6f3', transform: 'none' } },
      },
      animation: { recalc: 'recalc .9s ease-out' },
    },
  },
  plugins: [],
};

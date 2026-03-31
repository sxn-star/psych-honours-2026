/** @type {import('tailwindcss').Config} */
module.exports = {
  // Files Tailwind scans to detect which class names you use.
  // Only the classes found here are included in styles/output.css.
  darkMode: "class",
  content: ["./index.html", "./student.html", "./app.js", "./student.js", "./students.js"],
  theme: {
    // Add custom colors, spacing, fonts, etc. here later if needed.
    extend: {
      colors: {
        brand: {
          deep: "#546B79",
          sky: "#7CACD2",
          mist: "#E0F6FD",
          paper: "#FDFEFF"
        }
      }
    },
  },
  // Optional Tailwind plugins can be added here.
  plugins: [],
}


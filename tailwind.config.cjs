// The studio's own design tokens and components, scanning both the studio and the phone code.
const path = require("node:path");
const studio = require("../StickMan/tailwind.config.cjs");

module.exports = {
  ...studio,
  content: [path.join(__dirname, "index.html"), path.join(__dirname, "src/**/*.{ts,tsx}"), path.join(__dirname, "../StickMan/src/**/*.{ts,tsx}")],
};

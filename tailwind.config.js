/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          hover: "#1677FF",
          soft: "#EFF6FF",
          border: "#BFDBFE",
        },
        background: "#FFFFFF",
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F8FAFC",
          muted: "#F1F5F9",
        },
        content: {
          DEFAULT: "#172033",
          secondary: "#475569",
          muted: "#64748B",
          placeholder: "#98A2B3",
        },
        border: {
          DEFAULT: "#E2E8F0",
          subtle: "#EDF1F7",
        },
        sidebar: {
          DEFAULT: "#0F172A",
          muted: "#94A3B8",
        },
        danger: {
          DEFAULT: "#DC2626",
          soft: "#FEF2F2",
          border: "#FCA5A5",
        },
        success: {
          DEFAULT: "#15803D",
          soft: "#F0FDF4",
          border: "#86EFAC",
        },
        warning: "#B45309",
      },
      borderRadius: {
        control: "10px",
        card: "12px",
        compact: "8px",
      },
      height: {
        control: "34px",
        header: "54px",
      },
      minHeight: {
        control: "34px",
        header: "54px",
      },
      spacing: {
        "page-x": "6px",
        "page-t": "12px",
        "page-b": "8px",
      },
      fontSize: {
        caption: ["11px", "15px"],
        label: ["12px", "17px"],
        body: ["13px", "19px"],
        card: ["16px", "22px"],
        section: ["17px", "23px"],
        title: ["20px", "26px"],
      },
    },
  },
  plugins: [],
};

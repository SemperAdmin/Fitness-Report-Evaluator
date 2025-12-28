# Style Guide

## Dark Mode Color Palette

This project uses a Slate-based dark mode palette to ensure high contrast and visual consistency, complying with WCAG 2.1 AA standards.

### Backgrounds
- **Main Background**: `#0f172a` (Slate 900) - Body background
- **Secondary Background**: `#1e293b` (Slate 800) - Cards, Panels, Modals, Section Headers
- **Tertiary Background**: `#334155` (Slate 700) - Borders, Dividers, Input Backgrounds

### Text Colors
- **Primary Text**: `#f1f5f9` (Slate 100) - Headings, Main content, Modal Titles
- **Secondary Text**: `#cbd5e1` (Slate 300) - Descriptions, Subtitles, Paragraphs
- **Muted Text**: `#94a3b8` (Slate 400) - Metadata, Placeholders, Helper text
- **Disabled Text**: `#64748b` (Slate 500)

### Brand & Accents
- **Primary Blue**: `#60a5fa` (Blue 400) - Links, Active states, Primary Buttons
- **Secondary Sky**: `#7dd3fc` (Sky 300) - Focus rings, Highlights, Strong text
- **Success**: `#4ade80` (Green 400) - Success messages, Icons, Valid states
- **Warning**: `#fbbf24` (Amber 400) - Warnings, Attention items
- **Error**: `#f87171` (Red 400) - Error messages, Invalid states

### Component Specifics

#### Modals & Panels
- **Container**: `#1e293b` background
- **Border**: `#334155` (1px solid)
- **Overlay/Backdrop**: `rgba(15, 23, 42, 0.75)` (Slate 900 with opacity)

#### Evaluation Flow
- **Section Context**: Linear gradient `#1e293b` to `#0f172a`
- **Guidance Box**: `#334155` background with `#fbbf24` accent border
- **Decision Boxes**:
  - **Meets**: `rgba(22, 163, 74, 0.2)` background, `#4ade80` text
  - **Does Not Meet**: `rgba(220, 38, 38, 0.2)` background, `#f87171` text
  - **Surpasses**: `rgba(37, 99, 235, 0.2)` background, `#60a5fa` text

### Accessibility
- All text combinations meet a minimum contrast ratio of 4.5:1 (AA level).
- Interactive elements have a minimum target size of 44x44px.
- Focus states use `#7dd3fc` for clear visibility against dark backgrounds.

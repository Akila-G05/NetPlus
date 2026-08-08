---
name: Precision Network Utility
colors:
  surface: '#0d141e'
  surface-dim: '#0d141e'
  surface-bright: '#333946'
  surface-container-lowest: '#070e19'
  surface-container-low: '#151c27'
  surface-container: '#19202b'
  surface-container-high: '#232a36'
  surface-container-highest: '#2e3541'
  on-surface: '#dce3f2'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#dce3f2'
  inverse-on-surface: '#2a313c'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#bdf4ff'
  on-secondary: '#00363d'
  secondary-container: '#00e3fd'
  on-secondary-container: '#00616d'
  tertiary: '#78dc77'
  on-tertiary: '#00390a'
  tertiary-container: '#41a447'
  on-tertiary-container: '#003208'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#9cf0ff'
  secondary-fixed-dim: '#00daf3'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#94f990'
  tertiary-fixed-dim: '#78dc77'
  on-tertiary-fixed: '#002204'
  on-tertiary-fixed-variant: '#005313'
  background: '#0d141e'
  on-background: '#dce3f2'
  surface-variant: '#2e3541'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  element-gap: 8px
  stack-gap: 12px
  section-margin: 24px
---

## Brand & Style

The design system is engineered for high-stakes technical environments where speed of data interpretation is critical. The brand personality is **utilitarian, precise, and authoritative**, targeting network engineers and system administrators who require a "heads-up display" experience on mobile.

The aesthetic follows a **Corporate Modern** style with **Minimalist** efficiency. It prioritizes information density over decorative elements, using high-contrast typography and intentional color-coding to signal system status. The interface relies on structural integrity through rigid grid alignment and clear containment, ensuring that complex diagnostic data remains legible and actionable.

## Colors

The palette is rooted in a deep "Midnight" foundation to reduce eye strain during long diagnostic sessions in server rooms or low-light environments. 

- **Primary (Electric Blue):** Used for primary actions, active states, and focus indicators.
- **Secondary (Cyan):** Used for data visualization highlights, progress bars, and secondary interactive elements.
- **Surface (Charcoal Navy):** Used for card backgrounds and elevated containers to create a distinct layer above the base background.
- **Functional Colors:** Success (Emerald), Warning (Amber), and Error (Crimson) are reserved strictly for status indicators and critical alerts to maintain their semantic power.

## Typography

This design system utilizes a dual-font approach to distinguish between UI navigation and technical data.

- **Inter** is the primary typeface for all UI labels, headers, and descriptive text. It provides exceptional legibility at small sizes.
- **JetBrains Mono** is utilized for all "machine-readable" data, including IP addresses, MAC addresses, terminal output, and packet headers. 

Hierarchy is established through weight and color rather than excessive size differences, maintaining a high-density layout. Use `label-caps` for section headers and table column titles to provide clear structural anchoring.

## Layout & Spacing

The design system employs a **4px baseline grid** to achieve high information density without sacrificing touch target accessibility. 

- **Grid:** A 12-column fluid grid is used for tablet layouts, while mobile defaults to a single-column stack with 16px side margins.
- **Density:** Padding within cards and list items is kept tight (12px or 16px) to maximize the amount of data visible on a single screen.
- **Reflow:** On wider screens (tablets), diagnostic dashboards should reflow into a two or three-column bento-box style layout to utilize horizontal space for real-time graphs.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows, maintaining a crisp, digital feel.

1.  **Level 0 (Base):** `#0A0E14` - The canvas.
2.  **Level 1 (Surface):** `#141B26` - Cards and primary containers. These should feature a 1px solid border of `#1F2937` (Light Charcoal) to define edges against the dark background.
3.  **Level 2 (Overlay):** `#1C2533` - Modals and tooltips. These use a soft, 10% opacity black shadow with a 12px blur to suggest a slight lift.

Interactive elements (buttons/inputs) do not use shadows; they use fill-color changes and border-color shifts to indicate state.

## Shapes

The shape language balances technical precision with modern mobile ergonomics. 

- **Cards & Large Containers:** Use a `16px` (1rem) corner radius to soften the high-density data and make the app feel approachable.
- **Buttons & Inputs:** Use a `8px` (0.5rem) corner radius for a more rigid, "tool-like" appearance.
- **Status Tags/Chips:** Use a fully rounded "pill" shape to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use a solid Electric Blue fill with white text. Secondary buttons use a transparent fill with a 1px Cyan border. 
- **Data Cards:** Use the `16px` rounded corners with a `1px` border. Inside, use `label-caps` for the title and `code-lg` for the primary metric or value.
- **Diagnostic Lists:** Use thin horizontal dividers (`#1F2937`). Each row should have a minimum height of 48px to remain touch-friendly.
- **Input Fields:** Darker than the surface color with a subtle 1px border. On focus, the border transitions to Electric Blue with a faint outer glow.
- **Status Indicators:** Small 8px circles or subtle glows. Avoid large blocks of color for status; use "Light-on-Dark" text treatments within small pill-shaped chips.
- **Monospace Tables:** For logs and packet captures, use a zebra-stripe pattern with a very slight color variance (`#141B26` and `#18202B`) to improve horizontal scanning.
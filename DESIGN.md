# Design System

## Framework

- **Tailwind CSS v4** with `tw-animate-css`
- Class utility: `cn()` (clsx + tailwind-merge) in `src/lib/utils.ts`

## Color Palette

### Base Colors (OKLCH)

| Token | Light | Dark |
|---|---|---|
| background | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| foreground | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| card | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| popover | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| primary | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| primary-foreground | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| secondary | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| muted | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| accent | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| border / input | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10-15%)` |
| destructive | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| ring | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |

### Custom Hex Colors

**Grays**

| Token | Hex |
|---|---|
| gray-50 | #f9fafb |
| gray-100 | #f3f4f6 |
| gray-200 | #e5e7eb |
| gray-300 | #d1d5db |
| gray-400 | #9ca3af |
| gray-500 | #6b7280 |
| gray-700 | #374151 |
| gray-800 | #1f2a37 |
| gray-900 | #111928 |

**Primary (Blue)**

| Token | Hex |
|---|---|
| primary-50 | #ebf5ff |
| primary-100 | #e1effe |
| primary-200 | #c3ddfd |
| primary-300 | #a4cafe |
| primary-600 | #1c64f2 |
| primary-700 | #1a56db |

**Green**

| Token | Hex |
|---|---|
| green-50 | #f3faf7 |
| green-100 | #def7ec |
| green-800 | #03543f |

**Yellow**

| Token | Hex |
|---|---|
| yellow-100 | #fdf6b2 |
| yellow-800 | #723b13 |

**Purple**

| Token | Hex |
|---|---|
| purple-50 | #f6f5ff |

**Indigo**

| Token | Hex |
|---|---|
| indigo-25 | #f5f8ff |
| indigo-100 | #e0eaff |
| indigo-600 | #444ce7 |

### Chart Colors (OKLCH)

| Token | Light | Dark |
|---|---|---|
| chart-1 | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` |
| chart-2 | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` |
| chart-3 | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)` |
| chart-4 | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` |
| chart-5 | `oklch(0.769 0.188 70.08)` | `oklch(0.645 0.246 16.439)` |

### Sidebar Colors (OKLCH)

| Token | Light | Dark |
|---|---|---|
| sidebar | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| sidebar-foreground | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| sidebar-primary | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| sidebar-accent | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |

## Typography

- **Sans**: `var(--font-geist-sans)` → `font-sans`
- **Mono**: `var(--font-geist-mono)` → `font-mono`

## Spacing & Radius

| Token | Value |
|---|---|
| --radius | 0.625rem (10px) |
| radius-sm | calc(var(--radius) - 4px) = 6px |
| radius-md | calc(var(--radius) - 2px) = 8px |
| radius-lg | var(--radius) = 10px |
| radius-xl | calc(var(--radius) + 4px) = 14px |

## Breakpoints

| Token | Value |
|---|---|
| --breakpoint-mobile | 100px |
| --breakpoint-tablet | 640px |
| --breakpoint-pc | 769px |

## Global Rules

- Scrollbars hidden: `scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar { display: none }`
- Base: all elements `border-border`, outline `ring/50`; body `bg-background text-foreground`

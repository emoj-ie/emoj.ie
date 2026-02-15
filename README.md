# emoj.ie
Website for emoj.ie

## ✨ Features

- 🔍 **Smart Search**: Instant search with live filtering
- 🏷️ **Advanced Filtering**: Filter by emoji groups and subgroups (accessible via burger menu)
- 🌙 **Dark Mode**: Toggle between light and dark themes with system preference detection
- 🍔 **Burger Menu**: Collapsible menu for mobile and desktop with smooth animations
- 📱 **Responsive Design**: Optimized for all devices and screen sizes
- ♿ **Accessibility**: Full keyboard navigation and screen reader support
- 💾 **Offline Support**: Service worker caching for offline use
- 🎨 **Modern UI**: Sleek design with smooth animations and transitions

## 🚀 Getting Started

The site is fully static and works immediately. Features include:

- **Live Search**: Type to instantly filter emojis
- **Category Filters**: Narrow down by emoji groups and subgroups
- **Theme Toggle**: Click the moon/sun icon for dark/light mode
- **Recent History**: Automatically tracks your recently used emojis

## 🏗️ Build Pipeline

Phase 1 introduced a deterministic generator with manifest-based sync and legacy redirects.

### Commands

- `node utils/openmoji-grouper.js`
  - Rebuilds `grouped-openmoji.json` from `openmoji.json`
- `node utils/build/index.mjs --check`
  - Renders and validates output in a temp build directory without syncing
- `node utils/build/index.mjs`
  - Full sync build: regenerates managed emoji routes, redirect stubs, and split sitemaps
- `node utils/pages-maker.js`
  - Compatibility alias to `node utils/build/index.mjs`

### Generated Artifacts

- `build-manifest.json`
  - Source-aware, deterministic manifest of managed roots/files and build stats
- `sitemap-core.xml`
  - Home/about/group/subgroup index routes
- `sitemap-emoji.xml`
  - Indexable emoji detail routes
- `sitemap.xml`
  - Sitemap index referencing split sitemap files

## 🎯 User Experience Highlights

- **Smooth Animations**: Modern transitions and micro-interactions
- **Touch Optimized**: Perfect mobile experience with touch gestures
- **Keyboard Friendly**: Full keyboard navigation support
- **High Contrast**: Excellent readability in both themes
- **Performance**: Optimized for fast loading and smooth scrolling

## 🛠️ Technical Features

- **CSS Variables**: Modern theming system with CSS custom properties
- **Progressive Enhancement**: Works without JavaScript
- **Service Worker**: Offline functionality and caching
- **Modern Fonts**: Inter font family for crisp readability
- **Responsive Grid**: Flexible layouts that adapt to any screen size

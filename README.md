# WebCraft Academy

A minimalist, beginner-friendly HTML and CSS learning platform built with Next.js, React, TypeScript and Tailwind CSS.

## Features
- Learning dashboard and progress tracking (stored in React state for this starter version)
- Searchable lessons covering semantic HTML, forms, CSS box model, Flexbox and Grid
- Integrated HTML + CSS editor with a sandboxed live preview
- Interactive Flexbox and CSS Grid visual labs
- Practice challenges with hints and a quick knowledge check
- Responsive light-theme interface

## Run locally

Requirements: Node.js 18.18+ (Node.js 20 LTS recommended) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build for production

```bash
npm run build
npm start
```

## Notes
- Progress is currently held in client-side state and resets on a page refresh. Add persistence (for example localStorage) or authentication/database storage in a later phase.
- The live preview runs in a sandboxed iframe. It is intended for HTML and CSS practice, not arbitrary JavaScript execution.
- This starter intentionally has no backend or account system yet.

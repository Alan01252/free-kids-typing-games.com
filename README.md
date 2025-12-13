# Kids Free Typing Games

Hugo site with bite-sized typing games for kids. Uses Tailwind/PostCSS for styles and deploys to S3/CloudFront from GitHub Actions.

## Prerequisites
- Node.js 20+
- Hugo (extended) available in `$PATH`
- npm

## Install
```bash
npm ci
```

## Local development
```bash
npm run dev
```
Starts `hugo server --disableFastRender` with live reload at http://localhost:1313.

## Build
```bash
npm run build
```
Runs `hugo --gc --minify` and writes static output to `public/`.

## Deploy (CI)
Push to `main` triggers `.github/workflows/deploy.yml`:
- Checkout, Node 20 setup (npm cache), `npm ci`
- Install Hugo (extended, latest)
- `hugo --minify`
- Sync `public/` to the S3 bucket `free-kids-typing-games.com` (with `--delete`)
- Invalidate the CloudFront distribution `E2EN5YTZL6GEO8`

Required GitHub Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.

## Site config
`config.toml` sets `baseURL = "https://free-kids-typing-games.com/"`. Update this if the domain changes so sitemaps and canonical URLs stay correct.

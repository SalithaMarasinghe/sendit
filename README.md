# Sendit - Cross-Device File Sharing PWA

A production-ready MVP for personal file sharing across PC, iPhone, and iPad. Built with the Cloudflare stack.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (Metadata)
- **Storage**: Cloudflare R2 (Binary files)
- **PWA**: `vite-plugin-pwa` for installability

## Features
- Shared secret access model (no login flow)
- Folder management (Nested, Rename, Delete if empty)
- File operations (Upload, Rename, Delete, Download)
- Real-time upload progress bars (XMLHttpRequest)
- Case-insensitive duplicate checking
- Responsive design for Touch (iOS) and Desktop
- Installable PWA with offline shell caching

## Setup & Local Development

### 1. Prerequisites
- Cloudflare Account
- Node.js & npm
- Wrangler CLI (`npm install -g wrangler`)

### 2. Configuration
Create a D1 database and an R2 bucket in your Cloudflare dashboard.

Update `wrangler.toml`:
- `database_id`: Paste your D1 database ID.
- `bucket_name`: Paste your R2 bucket name.
- `AUTH_SECRET`: Set your desired passcode.

### 3. Initialize Database
```bash
npx wrangler d1 execute sendit-db --file=db/schema.sql --local
# For production:
# npx wrangler d1 execute sendit-db --file=db/schema.sql --remote
```

### 4. Run Locally
```bash
# Terminal 1: Frontend
npm install
npm run dev

# Terminal 2: Backend
npx wrangler dev
```

## Deployment

### 1. Deploy Frontend (Cloudflare Pages)
You can deploy the `dist` folder to Cloudflare Pages.
```bash
npm run build
npx wrangler pages deploy dist
```

### 2. Deploy Backend (Cloudflare Workers)
```bash
npx wrangler deploy
```

## Verification Checklist
- [ ] **Auth**: Reject wrong passcode, unlock with correct one.
- [ ] **Folders**: Create root folder, create nested folder.
- [ ] **Upload**: Upload to root and nested folder with progress bar.
- [ ] **Files**: Rename file, delete file, download file.
- [ ] **Security**: Verify duplicate filename rejection (case-insensitive).
- [ ] **PWA**: "Add to Home Screen" on iPhone/iPad works and launches in standalone mode.

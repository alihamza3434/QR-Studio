# QR Studio

A browser-first QR code generator built with Next.js. No account, backend, or paid QR API is required. QR data and history stay in the user's browser.

## Features

- URL, text, email, SMS, telephone, Bitcoin, Wi-Fi, X/Twitter and PDF-link QR codes
- Random QR payload generation, including batches
- CSV import for bulk generation
- PNG and SVG downloads, individual and ZIP batch export
- Foreground/background customization, optional center logo, size and error correction
- Browser-local QR history, print-friendly sheet, light/dark theme
- Responsive layout

## Requirements

- Node.js 18.17+ (Node 20 LTS recommended)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository at https://vercel.com/new.
3. Keep the detected Next.js framework and default build settings.
4. Deploy.

This is a static/client-side application. It does not require environment variables, a database, or API keys. A Vercel Hobby deployment is suitable for personal/non-commercial use; use a plan that permits your intended commercial use if you monetize it.

## CSV format

Upload a `.csv` file with a header row. Supported columns:
- `type` (optional): `url`, `text`, `email`, `sms`, `tel`, `bitcoin`, `wifi`, `twitter`, `pdf`, or `random`
- `name` (optional): label shown in the batch list
- `value` (required for most types): URL, text, address, phone number, Bitcoin address, Wi-Fi SSID, X profile URL, or PDF URL
- `subject`, `body`, `password`, `security`, `amount`, `country` (optional, type-dependent)

Examples:

```csv
type,name,value
url,Company website,https://example.com
text,Welcome message,Welcome to our event
email,Contact,email@example.com
wifi,Guest WiFi,GuestNetwork
```

For Wi-Fi rows, use `password` and optionally `security` (`WPA`, `WEP`, or `nopass`). For email, use `subject` and `body`. For SMS, use `body`. For Bitcoin, use `amount`.

## Privacy

QR generation runs in the browser. History is stored in `localStorage` on the current device/browser. Logo images are processed locally. No QR content is uploaded to a server by this app.

## Important notes

- PDF QR codes encode a publicly accessible PDF URL; the PDF itself is not embedded in the QR code.
- Random QR codes encode random text, not redirecting links.
- Scanning a QR code can open external websites or trigger device actions. Only scan codes from sources you trust.
- QR Studio does not verify the safety or ownership of entered URLs, wallet addresses, phone numbers, or Wi-Fi credentials.

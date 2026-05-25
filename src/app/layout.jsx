import './globals.css'

export const metadata = {
  title: 'הזירה — מערכת ניהול הפקה',
  description: 'מערכת ניהול הפקה לצוות הזירה',
}

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1ABBB4" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="הזירה" />
      </head>
      <body>{children}</body>
    </html>
  )
}

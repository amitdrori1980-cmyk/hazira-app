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
      </head>
      <body>{children}</body>
    </html>
  )
}

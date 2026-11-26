import './globals.css';

export const metadata = {
  title: 'DIU Smart Transport | University Transport Management System',
  description: 'Daffodil International University — Real-Time Fleet Tracking, Dynamic Seat Booking, SOS Safety & Transport Operations Platform',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('diu_transport_theme');
                  if (saved === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="liquid-bg antialiased selection:bg-slate-400/30">
        {children}
      </body>
    </html>
  );
}

import './globals.css';

export const metadata = {
  title: 'FinSan — Finance Tracker',
  description: 'Modern finance tracker with auth, budgets, goals, investments, and brokerage imports.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

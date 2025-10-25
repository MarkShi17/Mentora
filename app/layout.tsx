export const metadata = {
  title: 'Mentora Backend',
  description: 'AI-powered tutoring platform backend',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bulk Domain Search — check thousands of domains instantly",
  description:
    "Paste up to 5,000 names or domains and watch availability stream in live. Zone-file index, parallel DNS and RDAP verification. Free, no signup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Apply a stored theme choice and roll this load's accent hue before
            anything paints, so a reload never flashes the wrong colors. The
            hue is drawn only from segments far enough from the three status
            hues — red ~0°, green ~120°, blue ~213° (±25°) — so the accent
            never reads as an availability color. It goes into an appended
            <style> node, not an attribute — React wipes unexpected attributes
            from <html> when it hydrates, but leaves foreign head nodes
            alone. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}' +
              'var seg=[[25,95],[145,188],[238,335]],tot=0,i;for(i=0;i<3;i++)tot+=seg[i][1]-seg[i][0];' +
              'var r=Math.random()*tot,h=30;for(i=0;i<3;i++){var w=seg[i][1]-seg[i][0];if(r<w){h=Math.round(seg[i][0]+r);break}r-=w}' +
              'var s=document.createElement("style");s.textContent=":root{--accent-h:"+h+"}";document.head.appendChild(s);',
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

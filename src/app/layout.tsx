'use client'
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";
import 'react-photo-view/dist/react-photo-view.css';
import { Suspense, useEffect } from "react";
import { NextIntlProvider } from "@/components/providers/NextIntlProvider";
import Script from "next/script";
import { getSyncPushQueue } from "@/lib/sync/sync-push-queue";
import { ConsoleFilter } from "@/components/console-filter";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 初始化同步推送队列
  useEffect(() => {
    getSyncPushQueue()
  }, [])

  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* 移动端视口设置 */}
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover"
          />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          {/* Define isSpace function globally to fix markdown-it issues with Next.js + Turbopack
          https://github.com/markdown-it/markdown-it/issues/1082#issuecomment-2749656365 */}
          <Script id="markdown-it-fix" strategy="beforeInteractive">
            {`
              if (typeof window !== 'undefined' && typeof window.isSpace === 'undefined') {
                window.isSpace = function(code) {
                  return code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0B || code === 0x0C || code === 0x0D;
                };
              }
            `}
          </Script>
          <Script id="visual-audit-tauri-mock" strategy="beforeInteractive">
            {`
              if (
                typeof window !== 'undefined'
                && window.location.pathname.startsWith('/visual-audit/')
                && typeof window.__TAURI_INTERNALS__ === 'undefined'
              ) {
                const callbacks = new Map();
                let callbackId = 1;
                window.__TAURI_INTERNALS__ = {
                  transformCallback(callback, once) {
                    const id = callbackId++;
                    callbacks.set(id, { callback, once });
                    return id;
                  },
                  unregisterCallback(id) {
                    callbacks.delete(id);
                  },
                  convertFileSrc(path) {
                    return path;
                  },
                  async invoke(command) {
                    if (command === 'plugin:store|load') return 1;
                    if (command === 'plugin:store|get_store') return null;
                    if (command === 'plugin:store|get') return [null, false];
                    if (command === 'plugin:store|has') return false;
                    if (command === 'plugin:store|keys') return [];
                    if (command === 'plugin:store|values') return [];
                    if (command === 'plugin:store|entries') return [];
                    if (command === 'plugin:store|length') return 0;
                    if (command.includes('|listen')) return 1;
                    return null;
                  },
                };
              }
            `}
          </Script>
        </head>
        <body suppressHydrationWarning>
          <ConsoleFilter />
          <Suspense>
            <TooltipProvider>
              <NextIntlProvider>
                {children}
              </NextIntlProvider>
            </TooltipProvider>
          </Suspense>
          <Toaster closeButton richColors position="bottom-right" />
        </body>
      </html>
    </>
  );
}

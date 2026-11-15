import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const today = new Date().toISOString().split('T')[0]
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...['/', '/learn/fall', '/learn/share', '/learn/tree', '/tomorrow', '/mirror', '/blueprint', '/world/physics', '/world/math', '/world/biology', '/world/chemistry', '/world/english', '/world/bangla', '/world/ict', '/world/social'].flatMap((p) => [
            '  <url>',
            `    <loc>${origin}${p}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            '  </url>',
          ]),
          '</urlset>',
        ].join('\n')
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

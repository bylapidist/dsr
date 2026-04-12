import { defineConfig } from 'vitepress';

const guideSidebar = [
  {
    text: 'Get started',
    items: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Installation', link: '/installation' },
      { text: 'Quickstart', link: '/quickstart' },
    ],
  },
  {
    text: 'Environments',
    items: [
      { text: 'Node.js', link: '/environments/node' },
      { text: 'Browser', link: '/environments/browser' },
      { text: 'Edge / snapshot', link: '/environments/edge' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'DSQL query API', link: '/dsql' },
      { text: 'Write API', link: '/write-api' },
      { text: 'Kernel Wire Protocol', link: '/kwp' },
      { text: 'Snapshot format', link: '/snapshot' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'API reference', link: '/api' },
      { text: 'Changelog guide', link: '/changelog-guide' },
    ],
  },
];

export default defineConfig({
  title: 'dsr',
  description: 'Design System Runtime — long-lived kernel process holding the complete design system graph in memory.',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://dsr.lapidist.net' },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/introduction' },
      { text: 'DSQL', link: '/dsql' },
      { text: 'API', link: '/api' },
    ],
    sidebar: {
      '/': guideSidebar,
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/bylapidist/dsr' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Lapidist contributors',
    },
    editLink: {
      pattern: 'https://github.com/bylapidist/dsr/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});

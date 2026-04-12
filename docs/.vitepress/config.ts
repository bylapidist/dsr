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
    text: 'Reference',
    items: [
      { text: 'DSQL query API', link: '/dsql' },
      { text: 'Write API', link: '/write-api' },
      { text: 'Snapshots', link: '/snapshot' },
      { text: 'Kernel Wire Protocol', link: '/kwp' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'API', link: '/api' },
      { text: 'Changelog guide', link: '/changelog-guide' },
    ],
  },
  {
    text: 'Environments',
    items: [
      { text: 'NodeEnvironment', link: '/environments/node' },
      { text: 'BrowserEnvironment', link: '/environments/browser' },
      { text: 'EdgeEnvironment', link: '/environments/edge' },
    ],
  },
];

export default defineConfig({
  title: 'dsr',
  description: 'Design System Runtime for the Lapidist ecosystem',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://dsr.lapidist.net' },
  themeConfig: {
    logo: '/logo.svg',
    outline: { level: [2, 3], label: 'On this page' },
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Guide', link: '/introduction', activeMatch: '^/(introduction|installation|quickstart)$' },
      { text: 'DSQL', link: '/dsql', activeMatch: '^/dsql' },
      { text: 'Environments', link: '/environments/node', activeMatch: '^/environments/' },
      {
        text: 'Reference',
        activeMatch: '^/(write-api|snapshot|kwp|architecture|api|changelog-guide)',
        items: [
          { text: 'DSQL query API', link: '/dsql' },
          { text: 'Write API', link: '/write-api' },
          { text: 'Snapshots', link: '/snapshot' },
          { text: 'Kernel Wire Protocol', link: '/kwp' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'API', link: '/api' },
          { text: 'Changelog guide', link: '/changelog-guide' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bylapidist/dsr' },
    ],
    sidebar: {
      '/': guideSidebar,
    },
    editLink: {
      pattern: 'https://github.com/bylapidist/dsr/edit/main/docs/:path',
      text: 'Edit this page',
    },
    lastUpdatedText: 'Last updated',
    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
    footer: {
      message: 'Released under the MIT License.',
    },
  },
  markdown: {
    headers: {
      level: [2, 3, 4],
    },
  },
});

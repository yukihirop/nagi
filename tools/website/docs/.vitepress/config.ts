import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

export default defineConfig({
  vite: {
    plugins: [
      llmstxt({
        ignoreFiles: ['assets/*', 'ja/*', 'ja/**/*', 'index.md', '*/index.md'],
      }),
    ],
  },

  title: 'Nagi',
  description: 'Agent orchestration platform that routes messages from Slack, Discord, and Asana to AI agents in Docker containers',

  sitemap: { hostname: 'https://nagi-docs.vercel.app' },

  head: [
    ['meta', { name: 'theme-color', content: '#4a9eff' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon.png' }],
    ['meta', { property: 'og:title', content: 'Nagi' }],
    ['meta', { property: 'og:description', content: 'Agent orchestration platform that routes messages from Slack, Discord, and Asana to AI agents in Docker containers' }],
    ['meta', { property: 'og:image', content: 'https://nagi-docs.vercel.app/icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
  ],

  locales: {
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: 'ホーム', link: '/ja/' },
          { text: 'ドキュメント', link: '/ja/01_introduction' },
          {
            text: 'LLMs',
            items: [
              { text: 'llms.txt', link: '/llms.txt', target: '_blank' },
              { text: 'llms-full.txt', link: '/llms-full.txt', target: '_blank' }
            ]
          }
        ],
        sidebar: [
          {
            text: 'はじめに',
            items: [
              { text: 'Nagi とは', link: '/ja/01_introduction' },
            ]
          },
          {
            text: 'アーキテクチャ',
            items: [
              { text: 'システム構成', link: '/ja/02_architecture' },
            ]
          },
          {
            text: 'セットアップ',
            items: [
              { text: 'インストールと初期設定', link: '/ja/03_setup' },
            ]
          },
          {
            text: 'スキルリファレンス',
            items: [
              { text: 'スキル一覧', link: '/ja/04_skills_overview' },
              { text: 'セットアップ', link: '/ja/05_skills_setup' },
              { text: 'サービス制御', link: '/ja/06_skills_service' },
              { text: 'デプロイ・同期', link: '/ja/07_skills_deploy' },
              { text: 'エージェント切替', link: '/ja/08_skills_agent' },
              { text: 'チャンネルプラグイン', link: '/ja/09_skills_channel' },
              { text: 'MCP プラグイン', link: '/ja/10_skills_mcp' },
              { text: 'エージェントフック', link: '/ja/11_skills_hooks' },
              { text: 'グループプロンプト', link: '/ja/12_skills_group_prompt' },
              { text: 'プラグイン開発', link: '/ja/13_skills_scaffold' },
              { text: 'その他', link: '/ja/14_skills_misc' },
            ]
          }
        ],
        outline: { label: '目次' },
        docFooter: { prev: '前のページ', next: '次のページ' }
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Docs', link: '/en/01_introduction' },
          {
            text: 'LLMs',
            items: [
              { text: 'llms.txt', link: '/llms.txt', target: '_blank' },
              { text: 'llms-full.txt', link: '/llms-full.txt', target: '_blank' }
            ]
          }
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/en/01_introduction' },
            ]
          },
          {
            text: 'Architecture',
            items: [
              { text: 'System Overview', link: '/en/02_architecture' },
            ]
          },
          {
            text: 'Setup',
            items: [
              { text: 'Installation & Configuration', link: '/en/03_setup' },
            ]
          },
          {
            text: 'Skills Reference',
            items: [
              { text: 'Overview', link: '/en/04_skills_overview' },
              { text: 'Setup', link: '/en/05_skills_setup' },
              { text: 'Service Control', link: '/en/06_skills_service' },
              { text: 'Deploy & Sync', link: '/en/07_skills_deploy' },
              { text: 'Agent Switching', link: '/en/08_skills_agent' },
              { text: 'Channel Plugins', link: '/en/09_skills_channel' },
              { text: 'MCP Plugins', link: '/en/10_skills_mcp' },
              { text: 'Agent Hooks', link: '/en/11_skills_hooks' },
              { text: 'Group Prompts', link: '/en/12_skills_group_prompt' },
              { text: 'Plugin Scaffolding', link: '/en/13_skills_scaffold' },
              { text: 'Misc', link: '/en/14_skills_misc' },
            ]
          }
        ],
        outline: { label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' }
      }
    }
  },

  themeConfig: {
    logo: '/icon.png',
    search: {
      provider: 'local'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/yukihirop/nagi' }
    ]
  }
})

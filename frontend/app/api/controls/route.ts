import {NextResponse} from 'next/server';

export async function GET() {
    const data = {
    controls: [
      {
        id: 'BASE-0001',
        title: '多要素認証の実施',
        category: 'Access Control',
        tags: ['MFA', '認証', '2FA'],
        version: 'v5',
        updatedAt: '2025-03-06T14:30:00Z', // APIのやり取りはISO 8601形式
        author: '山田',
        status: 'active'
      },
      {
        id: 'BASE-0002',
        title: 'パスワードポリシー（複雑性・有効期限）',
        category: 'Access Control',
        tags: ['パスワード', 'ポリシー'],
        version: 'v2',
        updatedAt: '2025-02-15T10:00:00Z',
        author: '佐藤',
        status: 'active'
      },
      {
        id: 'BASE-0128',
        title: 'ゼロトラストアクセス制御',
        category: 'Network Security',
        tags: ['ゼロトラスト', 'VPN'],
        version: 'v1',
        updatedAt: '2025-03-01T09:00:00Z',
        author: '鈴木',
        status: 'active'
      }
    ],
    totalCount: 3
  };
  await new Promise(resolve => setTimeout(resolve, 500)); // 疑似的な遅延
  return NextResponse.json(data);
}
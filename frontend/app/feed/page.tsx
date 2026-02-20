import Link from "next/link";

export default function FeedPage() {
    const feedItems = [
    {
      id: 1,
      type: 'update',
      user: '山田',
      action: 'Controlを更新しました',
      targetId: 'BASE-0001',
      targetName: '多要素認証の実施',
      details: 'v4 → v5 に更新 (SMS認証の廃止を反映)',
      time: '2時間前',
      date: '2025-03-06 14:30',
    },
    {
      id: 2,
      type: 'mapping',
      user: '鈴木',
      action: '手動マッピングを完了しました',
      targetId: 'BASE-0045',
      targetName: 'クラウド基盤のアクセス制御',
      details: '「A社_セキュリティチェックシート.csv」の3件の質問を紐付け',
      time: '昨日',
      date: '2025-03-05 16:15',
    },
    {
      id: 3,
      type: 'create',
      user: '佐藤',
      action: '新規Controlを作成しました',
      targetId: 'BASE-0128',
      targetName: 'ゼロトラストアクセス制御',
      details: '新規作成 (v1)',
      time: '昨日',
      date: '2025-03-05 10:00',
    },
    {
      id: 4,
      type: 'upload',
      user: '田中',
      action: 'CSVを取り込みました',
      targetId: '',
      targetName: 'B社_委託先監査.csv',
      details: '全50問 (自動マッチ: 40問, 未マッチ: 10問)',
      time: '3日前',
      date: '2025-03-03 09:30',
    }
    ];
const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'update':return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'mapping':return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'create':return 'bg-green-100 text-green-800 border-green-200';
      case 'upload':return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
};
return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold mb-2">変更フィード</h1>
        <p className="text-gray-600">ナレッジベースの更新履歴や、チームメンバーの活動タイムラインです。</p>
      </div>

      {/* タイムライン */}
      <div className="relative border-l-2 border-gray-200 ml-4 mt-6 space-y-8 pb-8">
        {feedItems.map((item) => (
          <div key={item.id} className="relative pl-6">
            {/* タイムラインの丸ポチ */}
            <div className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full -left-[9px] top-1"></div>
            
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">{item.user}</span>
                  <span className="text-gray-600 text-sm">{item.action}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-500 block">{item.time}</span>
                  <span className="text-xs text-gray-400">{item.date}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${getBadgeStyle(item.type)}`}>
                    {item.type.toUpperCase()}
                  </span>
                  {item.targetId && (
                    <Link href={`/controls/${item.targetId}`} className="text-sm font-bold text-blue-600 hover:underline">
                      {item.targetId}: {item.targetName}
                    </Link>
                  )}
                  {!item.targetId && (
                    <span className="text-sm font-bold text-gray-700">{item.targetName}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{item.details}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center">
        <button className="text-blue-600 hover:underline text-sm font-medium">
          さらに過去の履歴を読み込む...
        </button>
      </div>
    </div>
  );
}
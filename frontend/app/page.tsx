export default function DashboardPage() {
    return (
        <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* 統計パネル */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">登録済み Control 数</h3>
          <p className="text-3xl font-bold mt-2">1,204</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">未マッチ質問 (要対応)</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">23</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">今週のチーム更新</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">15</p>
        </div>
      </div>

      {/* 直近のアクティビティ (モック) */}
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">最近の更新</h2>
        <ul className="space-y-3">
          <li className="flex items-center text-sm border-b pb-2">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-3">更新</span>
            <span>「特権IDのMFA要件」を v5 に更新しました (山田 - 2時間前)</span>
          </li>
          <li className="flex items-center text-sm border-b pb-2">
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-3">新規</span>
            <span>「ゼロトラストアクセス制御」を追加しました (佐藤 - 昨日)</span>
          </li>
          <li className="flex items-center text-sm">
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs mr-3">マッピング</span>
            <span>A社セキュリティシートの3件を手動マッピングしました (鈴木 - 昨日)</span>
          </li>
        </ul>
      </div>
    </div>
    );
}
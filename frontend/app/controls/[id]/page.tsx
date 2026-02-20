import Link from "next/link";

export default function ControlsDetailPage({ params }: { params: { id: string } }) {
    const controlId = params.id;
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
      {/* 戻るリンク */}
      <div className="mb-4">
        <Link href="/controls" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          <span>← Control一覧へ戻る</span>
        </Link>
      </div>

      {/* ヘッダー情報 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {controlId}
              </span>
              <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200">
                Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">多要素認証の実施</h1>
          </div>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 text-sm font-medium">
            編集する
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 border-t pt-4">
          <div><span className="text-gray-400">カテゴリ:</span> Access Control</div>
          <div><span className="text-gray-400">タグ:</span> MFA, 認証, 2FA</div>
          <div><span className="text-gray-400">現在の版:</span> <span className="font-semibold text-gray-800">v5</span></div>
          <div><span className="text-gray-400">最終更新:</span> 山田 (2025-03-06 14:30)</div>
        </div>
      </div>

      {/* ナレッジ内容 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2">代表的な質問 (CSVからの抽出)</h3>
          <p className="bg-slate-50 p-3 rounded text-gray-800 border border-slate-100">
            特権IDに対して多要素認証（MFA）を適用していますか？
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2">確定済み回答 (v5)</h3>
          <p className="bg-blue-50 p-4 rounded text-gray-900 border border-blue-100 leading-relaxed">
            はい。特権アカウントを含むすべてのユーザーアカウントに対し、MFAを必須としています。認証にはTOTP（RFC 6238）準拠のアプリを使用し、SMSによる認証は廃止しています。
          </p>
        </div>
      </div>

      {/* 変更履歴・差分 (Diff) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">変更履歴 (版管理)</h2>
        
        <div className="space-y-4">
          {/* 最新の変更 */}
          <div className="border-l-2 border-blue-500 pl-4 py-1">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-gray-800">v4 → v5 の差分</span>
              <span className="text-xs text-gray-500">2025-03-06 (山田)</span>
            </div>
            <div className="bg-gray-50 p-3 rounded font-mono text-sm overflow-x-auto">
              {/* 削除されたテキスト */}
              <div className="text-red-600 bg-red-50 px-2 py-1 mb-1">
                - 認証にはTOTPアプリを使用し、<span className="bg-red-200 line-through">SMSによる認証も可としています。</span>
              </div>
              {/* 追加されたテキスト */}
              <div className="text-green-700 bg-green-50 px-2 py-1">
                + 認証にはTOTPアプリを使用し、<span className="bg-green-200 font-bold">SMSによる認証は廃止しています。</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">変更理由: セキュリティ監査の指摘に基づき、SMS認証を非推奨から完全廃止へ運用変更したため。</p>
          </div>

          {/* 過去の変更（折りたたみ等で表現すると良いですが、今回はモックとして静的表示） */}
          <div className="border-l-2 border-gray-200 pl-4 py-1 mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-600">v3 → v4 の差分</span>
              <span className="text-xs text-gray-500">2024-11-10 (佐藤)</span>
            </div>
            <p className="text-xs text-gray-500">代表質問のバリエーションを2件追加。</p>
          </div>
        </div>
      </div>
    </div>
    );
}
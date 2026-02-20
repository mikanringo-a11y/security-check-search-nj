export default function UnmatchedPage(){
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">未マッチ管理（手動マッピング）</h1>
          <p className="text-gray-600">CSVから取り込まれた質問のうち、Controlと紐付いていないタスク一覧です。</p>
        </div>
        <div className="text-sm font-medium bg-red-50 text-red-600 px-4 py-2 rounded-lg border border-red-200">
          残りタスク: 23件
        </div>
      </div>

      {/* タスクリスト（モックデータ） */}
      <div className="space-y-6 mt-6">
        
        {/* 未マッチタスク 1 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          {/* 質問セクション */}
          <div className="bg-slate-50 p-4 border-b border-gray-200">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded">A社_セキュリティチェックシート.csv</span>
              <span className="text-xs text-gray-500">行番号: 12</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Q. クラウド環境における特権IDへのアクセスに対し、どのような認証方式を採用していますか？
            </h3>
          </div>

          {/* マッピング候補セクション */}
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-500 mb-3">検索サジェスト候補</h4>
            <div className="space-y-3">
              {/* 候補1 */}
              <div className="flex items-center justify-between border border-blue-100 bg-blue-50 p-3 rounded hover:border-blue-300 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-blue-800">BASE-0001: 多要素認証の実施</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">スコア: 高</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    回答: 特権アカウントを含むすべてのユーザーアカウントに対し、MFAを必須としています...
                  </p>
                </div>
                <button className="ml-4 bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                  このControlを紐付ける
                </button>
              </div>

              {/* 候補2 */}
              <div className="flex items-center justify-between border border-gray-100 bg-gray-50 p-3 rounded hover:border-gray-300 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-700">BASE-0045: クラウド基盤のアクセス制御</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">スコア: 中</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    回答: AWS等のクラウド基盤へのアクセスは、IP制限とIAMロールによる最小権限...
                  </p>
                </div>
                <button className="ml-4 bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-100">
                  このControlを紐付ける
                </button>
              </div>
            </div>

            {/* 新規作成ボタン */}
            <div className="mt-4 text-right">
              <button className="text-sm text-blue-600 hover:underline">
                + 該当なし（新しいControlとして登録する）
              </button>
            </div>
          </div>
        </div>

        {/* 未マッチタスク 2 (簡略版) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-gray-200">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded">B社_委託先監査.csv</span>
              <span className="text-xs text-gray-500">行番号: 45</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Q. 退職者のアカウントは、退職後何日以内に削除または無効化されますか？
            </h3>
          </div>
          <div className="p-4 flex justify-between items-center">
             <span className="text-sm text-gray-500">サジェスト候補が見つかりません。検索して探すか、新規作成してください。</span>
             <div className="flex gap-2">
               <button className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-100">
                 検索する
               </button>
               <button className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700">
                 新規Control作成
               </button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
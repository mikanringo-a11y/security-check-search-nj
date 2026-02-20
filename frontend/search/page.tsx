export default function SearchPage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-2">ナレッジ検索</h1>
        <p className="text-gray-600">過去の確定済みControl（回答）を検索します。</p>
      </div>

      {/* 検索ボックス */}
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="検索キーワードを入力 (例: 多要素認証, MFA, AWS)" 
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          検索
        </button>
      </div>

      {/* 検索結果（モックデータ） */}
      <div className="space-y-4 mt-8">
        <h2 className="text-lg font-semibold border-b pb-2">検索結果: 2件</h2>

        {/* 結果カード 1 */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-blue-700">BASE-0001: 多要素認証の実施</h3>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">v5</span>
          </div>
          <div className="text-sm text-gray-500 mb-3 space-x-2">
            <span>カテゴリ: Access Control</span>
            <span>|</span>
            <span>タグ: MFA, 認証, 2FA</span>
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <span className="font-semibold text-gray-700 block mb-1">確定済み回答:</span>
            <p className="text-gray-800">
              はい。特権アカウントを含むすべてのユーザーアカウントに対し、MFAを必須としています。認証にはTOTP（RFC 6238）準拠のアプリを使用し、SMSによる認証は廃止しています。
            </p>
          </div>
        </div>

        {/* 結果カード 2 */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-blue-700">BASE-0128: ゼロトラストアクセス制御</h3>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">v1</span>
          </div>
          <div className="text-sm text-gray-500 mb-3 space-x-2">
            <span>カテゴリ: Network Security</span>
            <span>|</span>
            <span>タグ: ゼロトラスト, VPN</span>
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <span className="font-semibold text-gray-700 block mb-1">確定済み回答:</span>
            <p className="text-gray-800">
              社内システムへのアクセスは、原則としてデバイス証明書とユーザー認証を組み合わせたゼロトラストネットワークアクセス（ZTNA）を経由して行われます。
            </p>
          </div>
        </div>

      </div>
    </div>
    );
}
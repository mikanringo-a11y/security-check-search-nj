"use client";

import { useState } from "react";
import Link from "next/link";
import { useUnmatched } from "../../hooks/useUnmatched";
import { securityClient } from "../../lib/api"; // 検索APIを叩くための共通クライアント
import type { Control } from "../../gen/proto/security/v1/service_pb";

export default function UnmatchedPage() {
  // ★ フックから linkTask も受け取るように変更
  const { tasks, isLoading, error, linkTask } = useUnmatched();

  // === モーダルと検索用のState ===
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Control[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // === 既存Controlの検索処理 ===
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await securityClient.searchControls({ query: searchQuery });
      setSearchResults(res.hits || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // === 紐付け実行処理 ===
  const handleLink = async (controlId: string) => {
    if (!linkingTaskId) return;
    
    const success = await linkTask(linkingTaskId, controlId);
    if (success) {
      // 成功したらモーダルを閉じて検索結果をリセット
      closeModal();
    }
  };

  const closeModal = () => {
    setLinkingTaskId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">未マッチ（新規質問）管理</h1>
          <p className="text-gray-600">
            アップロードされたチェックシートの中で、過去のナレッジと一致しなかった質問の一覧です。
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg">
          <p className="font-bold text-sm">エラーが発生しました: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden p-10 text-center text-gray-500">
          読み込み中...
        </div>
      ) : tasks.length === 0 && !error ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-500">
          現在、未回答の新しい質問はありません。
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                <th className="p-4 font-semibold w-1/4">ファイル名 (行番号)</th>
                <th className="p-4 font-semibold w-1/2">質問内容</th>
                <th className="p-4 font-semibold w-1/4">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="p-4 text-sm text-gray-700">
                    <span className="block font-medium truncate" title={task.originalFileName}>
                      {task.originalFileName}
                    </span>
                    <span className="text-xs text-gray-500">行: {task.rowNumber}</span>
                  </td>
                  <td className="p-4 text-sm text-gray-900 font-medium">
                    {task.questionText}
                  </td>
                  <td className="p-4 space-x-2">
                    {/* ★ ボタンを横並びに配置 */}
                    <Link
                      href={`/controls/new?question=${encodeURIComponent(task.questionText)}&taskId=${task.id}`}
                      className="inline-block px-3 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded hover:bg-blue-200 transition-colors"
                    >
                      回答を作成
                    </Link>
                    <button
                      onClick={() => setLinkingTaskId(task.id.toString())}
                      className="inline-block px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded hover:bg-gray-200 transition-colors"
                    >
                      既存に紐付ける
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === 紐付け用モーダル === */}
      {linkingTaskId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold">既存のナレッジを検索して紐付ける</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-4 border-b">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="キーワードで検索 (例: パスワード, MFA)"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSearching ? "検索中..." : "検索"}
                </button>
              </form>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
              {searchResults.length === 0 && !isSearching ? (
                <p className="text-center text-gray-500 py-8">検索結果がここに表示されます</p>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((control) => (
                    <div key={control.id} className="bg-white border border-gray-200 rounded p-4 shadow-sm">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2 inline-block">
                            {control.category}
                          </span>
                          <h3 className="font-bold text-gray-900">{control.title}</h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{control.answer}</p>
                        </div>
                        <button
                          onClick={() => handleLink(control.id)}
                          className="shrink-0 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded text-sm font-bold hover:bg-green-100 transition-colors"
                        >
                          これに紐付ける
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
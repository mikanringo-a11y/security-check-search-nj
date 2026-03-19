"use client";
import { useEffect, useState } from "react";
import { UploadForm } from "./UploadForm";
import { BulkImportForm } from "./BulkImportForm"; // ★ 新しく作ったフォームをインポート

// Ingestionの型定義
type Ingestion = {
  id: number;
  fileName: string;
  status: string;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
};

export default function UploadPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  // ★ どちらのタブを開いているかを管理するState
  const [activeTab, setActiveTab] = useState<"analyze" | "bulk">("analyze");

  // 履歴の取得処理
  const fetchIngestions = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/ingestions`);
      if (res.ok) {
        const data = await res.json();
        setIngestions(data || []);
      }
    } catch (error) {
      console.error("履歴の取得に失敗しました", error);
    }
  };

  useEffect(() => {
    fetchIngestions();
    const interval = setInterval(fetchIngestions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">データ取り込み</h1>

      {/* ★ タブ切り替えUI */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("analyze")}
          className={`pb-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === "analyze"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          チェックシートの解析
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`pb-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === "bulk"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          ナレッジの一括登録
        </button>
      </div>

      <div className="max-w-xl bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        {/* ★ タブの状態で表示を切り替える */}
        {activeTab === "analyze" ? (
          <div>
            <h2 className="text-lg font-bold mb-4 text-slate-800">取引先のチェックシートを読み込む</h2>
            <UploadForm onUploadSuccess={fetchIngestions} />
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-bold mb-4 text-green-800">完成したナレッジをまとめて登録する</h2>
            <BulkImportForm />
          </div>
        )}
      </div>

      {/* ★ 履歴テーブルは「解析タブ」の時だけ表示するか、常時表示するか選べます（今回は解析タブ用として表示） */}
      {activeTab === "analyze" && (
        <>
          <div className="max-w-3xl bg-blue-50 border-l-4 border-blue-500 p-5 mb-12 rounded-r-lg shadow-sm">
        <h3 className="text-base font-bold text-blue-800 mb-2 flex items-center gap-2">
          💡 アップロードするCSVの形式について
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          システムはCSVの<strong>3列目（C列）</strong>を「質問内容」として読み込み、ナレッジとの自動マッピングを行います。以下の形式に合わせてアップロードしてください。※1行目はヘッダーとして無視されます。
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm bg-white border border-blue-200">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-2 px-3 border border-blue-200 text-gray-700 font-semibold">A列 (管理番号など)</th>
                <th className="py-2 px-3 border border-blue-200 text-gray-700 font-semibold">B列 (カテゴリなど)</th>
                <th className="py-2 px-3 border border-blue-200 font-bold text-red-600 bg-red-50">C列 (質問内容) ※必須</th>
                <th className="py-2 px-3 border border-blue-200 text-gray-700 font-semibold">D列以降 (任意)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-3 border border-blue-200 text-gray-500">REQ-001</td>
                <td className="py-2 px-3 border border-blue-200 text-gray-500">認証</td>
                <td className="py-2 px-3 border border-blue-200 font-medium">特権IDに多要素認証(MFA)は導入されていますか？</td>
                <td className="py-2 px-3 border border-blue-200 text-gray-500">自由記述</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
          <h2 className="text-xl font-bold mt-12 mb-4">アップロード履歴</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 border">日時</th>
                  <th className="py-2 px-4 border">ファイル名</th>
                  <th className="py-2 px-4 border">ステータス</th>
                  <th className="py-2 px-4 border">担当者</th>
                </tr>
              </thead>
              <tbody>
                {ingestions.map((item) => (
                  <tr key={item.id} className="text-center">
                    <td className="py-2 px-4 border">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border">{item.fileName}</td>
                    <td className="py-2 px-4 border">
                      <span className={`px-2 py-1 rounded text-white text-sm ${
                        item.status === "COMPLETED" ? "bg-green-500" :
                        item.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"
                      }`}>
                        {item.status}
                      </span>
                      {item.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{item.errorMessage}</p>
                      )}
                    </td>
                    <td className="py-2 px-4 border">{item.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
"use client";
import { useEffect, useState } from "react";
// ※ UploadFormコンポーネントのインポート等

// Ingestionの型定義
type Ingestion = {
  ID: number;
  FileName: string;
  Status: string;
  ErrorMessage: string | null;
  CreatedBy: string;
  CreatedAt: string;
};

export default function UploadPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);

  // 履歴の取得処理
  const fetchIngestions = async () => {
    try {
      // バックエンドのURLに合わせて変更してください
      const res = await fetch("http://localhost:8080/api/ingestions"); 
      if (res.ok) {
        const data = await res.json();
        setIngestions(data || []);
      }
    } catch (error) {
      console.error("履歴の取得に失敗しました", error);
    }
  };

  // 初回マウント時と、一定間隔（ポーリング）で履歴を更新
  useEffect(() => {
    fetchIngestions();
    // 5秒ごとに最新のステータスを取得（処理中→完了 の変化を見るため）
    const interval = setInterval(fetchIngestions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">ファイルアップロード</h1>
      
      {/* 既存のアップロードフォーム（アップロード完了後に fetchIngestions() を呼ぶとより良いです） */}
      {/* <UploadForm onUploadSuccess={fetchIngestions} /> */}

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
              <tr key={item.ID} className="text-center">
                <td className="py-2 px-4 border">
                  {new Date(item.CreatedAt).toLocaleString()}
                </td>
                <td className="py-2 px-4 border">{item.FileName}</td>
                <td className="py-2 px-4 border">
                  {/* ステータスによって色を変える */}
                  <span className={`px-2 py-1 rounded text-white text-sm ${
                    item.Status === "COMPLETED" ? "bg-green-500" :
                    item.Status === "FAILED" ? "bg-red-500" : "bg-yellow-500"
                  }`}>
                    {item.Status}
                  </span>
                  {item.ErrorMessage && (
                    <p className="text-xs text-red-500 mt-1">{item.ErrorMessage}</p>
                  )}
                </td>
                <td className="py-2 px-4 border">{item.CreatedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
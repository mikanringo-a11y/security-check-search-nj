"use client";
import { useEffect, useState } from "react";
import { UploadForm } from "./UploadForm";
// ※ UploadFormコンポーネントのインポート等

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
      <div className="max-w-xl bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <UploadForm onUploadSuccess={fetchIngestions} />
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
                  {/* ステータスによって色を変える */}
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
    </div>
  );
}
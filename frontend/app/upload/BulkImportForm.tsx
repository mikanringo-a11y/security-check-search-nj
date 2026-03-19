"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { SecurityService } from "../../gen/proto/security/v1/service_pb";

// ConnectRPCクライアントの初期化
const transport = createConnectTransport({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
});
const client = createClient(SecurityService, transport);

export function BulkImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      toast.error("ファイルを選択してください。");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("CSVを解析中...");

    Papa.parse(file, {
      header: true, // 1行目をヘッダーとして扱う
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // CSVの各行をAPIのリクエスト形式にマッピング
          const items = results.data.map((row: any) => ({
            title: row["タイトル"] || "",
            category: row["カテゴリ"] || "",
            question: row["代表質問"] || "",
            answer: row["確定済み回答"] || "",
            tags: row["タグ"]
              ? row["タグ"].split(",").map((t: string) => t.trim()).filter((t: string) => t !== "")
              : [],
          }));

          if (items.length === 0) {
            toast.error("CSVにデータが見つかりませんでした。", { id: toastId });
            setIsUploading(false);
            return;
          }

          toast.loading(`${items.length}件のナレッジを登録中...`, { id: toastId });

          // 先ほど作ったバックエンドの BulkCreateAPI を呼び出し
          const response = await client.bulkCreateControls({ items });

          toast.success(
            `${response.successCount}件の登録に成功しました！\n(失敗: ${response.errorCount}件)`,
            { id: toastId, duration: 5000 }
          );

          if (response.errorCount > 0 && response.errorMessages.length > 0) {
            console.error("エラー詳細:", response.errorMessages);
            toast.error("一部の登録に失敗しました。コンソールを確認してください。");
          }

          // フォームをリセット
          formRef.current?.reset();
        } catch (error) {
          console.error("一括登録エラー", error);
          toast.error("登録処理に失敗しました。", { id: toastId });
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        toast.error(`CSVの読み込みに失敗しました: ${error.message}`, { id: toastId });
        setIsUploading(false);
      },
    });
  };

  return (
    <form ref={formRef} onSubmit={handleUpload} className="flex flex-col gap-6">
      <div className="group relative">
        <input
          type="file"
          name="file"
          accept=".csv"
          disabled={isUploading}
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2.5 file:px-6
            file:rounded-full file:border-0
            file:text-sm file:font-bold
            file:bg-green-50 file:text-green-700
            hover:file:bg-green-100
            file:cursor-pointer cursor-pointer
            transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl
            hover:bg-green-600 active:scale-[0.98]
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            font-bold text-sm shadow-lg shadow-green-200"
      >
        {isUploading ? "処理中..." : "ナレッジを一括登録"}
      </button>
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
        <p className="font-bold mb-1">💡 CSVのフォーマット</p>
        <p>1行目に以下のヘッダー（列名）をつけてください。</p>
        <code className="text-[10px] text-gray-700 block mt-1">タイトル,カテゴリ,代表質問,確定済み回答,タグ</code>
      </div>
    </form>
  );
}
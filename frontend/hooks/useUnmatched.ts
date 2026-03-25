import { useState, useEffect } from "react";
// ★ 共通クライアントをインポート
import { securityClient } from "../lib/api"; 
import type { UnmatchedTask } from "../gen/proto/security/v1/service_pb";
import toast from "react-hot-toast"; // 通知用に追加

export const useUnmatched = () => {
  const [tasks, setTasks] = useState<UnmatchedTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // 一覧取得処理（再利用できるように関数を外に出す）
  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 共通クライアントを使用
      const res = await securityClient.listUnmatchedTasks({});
      setTasks(res.tasks || []);
    } catch (err) {
      console.error("Failed to fetch unmatched tasks", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // ★ 追加：紐付けを実行するメソッド
  const linkTask = async (taskId: string, controlId: string) => {
    try {
      await securityClient.linkUnmatchedTask({
        unmatchedTaskId: taskId,
        controlId: controlId,
      });
      toast.success("既存のナレッジに紐付けました！");
      // 成功したら一覧を再取得（または該当タスクをstateから削除）して画面を更新
      await fetchTasks(); 
      return true;
    } catch (err) {
      console.error("Link task error:", err);
      toast.error("紐付けに失敗しました。");
      return false;
    }
  };

  return { tasks, isLoading, error, linkTask }; // linkTask を返す
};
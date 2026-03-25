"use server"; // ★ これを書くことで、このファイル内の関数はNext.jsのサーバー上でのみ実行されます

import { getServerSession } from "next-auth/next";
// ※ 注意: プロジェクト構成に合わせて、authOptions を適切にインポートして getServerSession(authOptions) にする必要があるかもしれません。
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { SecurityService } from "../../gen/proto/security/v1/service_pb";

// サーバー間通信用のクライアント設定
// ※ GKE上などで内部通信する場合は http://backend:8080 などの内部サービス名を指定するのが理想です
const transport = createConnectTransport({
    baseUrl: process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
});
const serverClient = createClient(SecurityService, transport);

export async function updateControlSecurely(formData: any) {
    // 1. Next.jsのサーバー側で安全にセッション（誰がログインしているか）を取得
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    // セッションがない（未ログイン）場合は弾く
    if (!userEmail) {
        throw new Error("認証されていません。ログインし直してください。");
    }

    try {
        // 2. Goバックエンドへリクエストを送る
        const res = await serverClient.updateControl({
            id: formData.id,
            title: formData.title,
            category: formData.category,
            question: formData.question,
            answer: formData.answer,
            tags: formData.tags,
        }, {
            // ★ ここで絶対に改ざん不可能なメールアドレスをヘッダーにセット！
            headers: {
                "X-User-Email": userEmail
            }
        });

        // Server Actionからクライアントへは、シンプルなオブジェクトだけを返す
        return { success: true };
    } catch (error) {
        console.error("Backend API Error:", error);
        throw new Error("バックエンドの更新処理に失敗しました");
    }
}
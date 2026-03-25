// frontend/lib/api.ts
import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient, Interceptor } from "@connectrpc/connect";
import { getSession } from "next-auth/react";
import { SecurityService } from "../gen/proto/security/v1/service_pb";

// ① すべてのリクエストに自動で割り込む Interceptor を定義
const authInterceptor: Interceptor = (next) => async (req) => {
  // NextAuthのセッションを取得
  const session = await getSession();
  
  // メアドがあればヘッダーにセットする
  if (session?.user?.email) {
    req.header.set("X-User-Email", session.user.email);
  } else {
    req.header.set("X-User-Email", "unknown");
  }

  // 本来のAPI通信を続行
  return await next(req);
};

// ② Interceptor を組み込んだ通信経路（Transport）を作成
export const transport = createConnectTransport({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  interceptors: [authInterceptor], // ★ ここでセット！
});

// ③ アプリ全体で使い回す、賢いクライアントの完成！
export const securityClient = createClient(SecurityService, transport);
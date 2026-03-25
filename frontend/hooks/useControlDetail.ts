import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

// ★ 追加: 共通のクライアントをインポートする
import { securityClient } from "../lib/api"; 
import type { Control } from "../gen/proto/security/v1/service_pb";
import { updateControlSecurely } from "../app/actions/controlActions";

export const useControlDetail = (controlId: string | null) => {
    const router = useRouter();
    const { data: session } = useSession();
    const [control, setControl] = useState<Control | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Control>>({}); 
    const [tagInput, setTagInput] = useState("");
    
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

   

    useEffect(() => {
        const fetchControlDetail = async () => {
            if (!controlId) return;
            setIsLoading(true);
            setError(null);
            try {
                // ★ 修正: securityClient を使う
                const res = await securityClient.getControl({ id: controlId });
                if (res.control) {
                    setControl(res.control);
                    setFormData(res.control);
                    setTagInput(res.control.tags ? res.control.tags.join(",") : "");
                } else {
                    throw new Error("コントロールが見つかりません");
                }
            } catch (err) {
                console.error("コントロールの詳細の取得に失敗:", err);
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setIsLoading(false);
            }
        };

        fetchControlDetail();
    }, [controlId]);


    const handleSave = async () => {
        try {
            
            const result = await updateControlSecurely({
                id: controlId,
                title: formData.title || "",
                category: formData.category || "",
                question: formData.question || "",
                answer: formData.answer || "",
                tags: tagInput.split(",").map(tag => tag.trim()).filter(tag => tag),
            });


            if (result.success) {
                // 成功したら画面の表示を更新して編集モードを終了
                setControl({ ...control, ...formData, tags: tagInput.split(",").map(t => t.trim()) } as Control);
                setIsEditing(false);
                toast.success("コントロールが更新されました");
            }
        } catch (err: any) {
            console.error("コントロールの更新に失敗:", err);
            toast.error(err.message || "コントロールの更新に失敗しました");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("本当にこのコントロールを削除しますか？")) return;
        setIsDeleting(true);
        try {
            // ★ 修正: securityClient を使う
            await securityClient.deleteControl({ id: controlId });
            toast.success("コントロールが削除されました");
            router.push("/controls"); 
        } catch (err) {
            console.error("コントロールの削除に失敗:", err);
            toast.error("コントロールの削除に失敗しました");
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        control,
        isEditing,
        setIsEditing,
        formData,
        setFormData,
        tagInput,
        setTagInput,
        isLoading,
        isDeleting,
        error,
        handleSave,
        handleDelete,
    };  
};
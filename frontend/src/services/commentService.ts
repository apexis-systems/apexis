import { PrivateAxios } from "@/helpers/PrivateAxios";

export interface Comment {
    id: number;
    target_id: number;
    target_type: string;
    user_id: number;
    text: string;
    parent_id?: number;
    user?: { id: number; name: string };
    replies?: Comment[];
    createdAt: string;
    is_deleted?: boolean;
    deleted_at?: string;
    is_edited?: boolean;
    edited_at?: string;
    edit_history?: { text: string; editedAt: string }[];
}

export const getComments = async (
    targetId: number | string,
    targetType: string
): Promise<Comment[]> => {
    const res = await PrivateAxios.get('/comments', {
        params: { file_id: targetId },
    });
    return res.data.comments || [];
};

export const addComment = async (data: {
    target_id: number | string;
    target_type: string;
    text: string;
    parent_id?: number;
}): Promise<Comment> => {
    const res = await PrivateAxios.post('/comments', {
        file_id: data.target_id,
        text: data.text,
        parent_id: data.parent_id
    });
    return res.data.comment;
};

export const updateComment = async (
    id: number | string,
    text: string
): Promise<Comment> => {
    const res = await PrivateAxios.put(`/comments/${id}`, { text });
    return res.data.comment;
};

export const deleteComment = async (
    id: number | string
): Promise<Comment> => {
    const res = await PrivateAxios.delete(`/comments/${id}`);
    return res.data.comment;
};


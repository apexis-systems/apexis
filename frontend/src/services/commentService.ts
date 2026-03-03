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
}

export const getComments = async (
    targetId: number | string,
    targetType: string
): Promise<Comment[]> => {
    const res = await PrivateAxios.get('/comments', {
        params: { target_id: targetId, target_type: targetType },
    });
    return res.data.comments || [];
};

export const addComment = async (data: {
    target_id: number | string;
    target_type: string;
    text: string;
    parent_id?: number;
}): Promise<Comment> => {
    const res = await PrivateAxios.post('/comments', data);
    return res.data.comment;
};

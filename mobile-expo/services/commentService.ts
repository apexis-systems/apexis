import { PrivateAxios } from '@/helpers/PrivateAxios';

export const getComments = async (fileId: string | number) => {
    const res = await PrivateAxios.get('/comments', { params: { file_id: fileId } });
    return res.data.comments as CommentThread[];
};

export const addComment = async (fileId: string | number, text: string, parentId?: string | number) => {
    const res = await PrivateAxios.post('/comments', { file_id: fileId, text, parent_id: parentId });
    return res.data.comment;
};

export const deleteComment = async (id: string | number) => {
    await PrivateAxios.delete(`/comments/${id}`);
};

export interface CommentThread {
    id: number;
    file_id: number;
    user_id: number;
    text: string;
    parent_id: number | null;
    createdAt: string;
    user: { id: number; name: string; email: string };
    replies: CommentThread[];
}

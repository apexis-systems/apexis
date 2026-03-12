import { PrivateAxios } from '@/helpers/PrivateAxios';

export const listRooms = async () => {
    try {
        const response = await PrivateAxios.get('/chats');
        return response.data.rooms;
    } catch (error: any) {
        console.error("listRooms Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const getRoomMessages = async (roomId: string | number) => {
    try {
        const response = await PrivateAxios.get(`/chats/${roomId}/messages`);
        return response.data.messages;
    } catch (error: any) {
        console.error("getRoomMessages Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const sendChatMessage = async (data: { roomId: string | number, text: string, recipientId?: number }) => {
    try {
        const response = await PrivateAxios.post('/chats/send', data);
        return response.data;
    } catch (error: any) {
        console.error("sendChatMessage Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const markMessageSeen = async (messageId: number) => {
    try {
        const response = await PrivateAxios.patch('/chats/seen', { messageId });
        return response.data;
    } catch (error: any) {
        console.error("markMessageSeen Error:", error?.response?.data || error.message);
        throw error;
    }
};

export const createRoom = async (data: { type: 'direct' | 'group', name?: string, memberIds: number[] }) => {
    try {
        const response = await PrivateAxios.post('/chats/create', data);
        return response.data.room;
    } catch (error: any) {
        console.error("createRoom Error:", error?.response?.data || error.message);
        throw error;
    }
};

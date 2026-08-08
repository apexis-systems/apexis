import { PrivateAxios } from '@/helpers/PrivateAxios';
import type { Blog } from '@/pages/Superadmin/Blogs/BlogEditor/types';

export const getBlogs = async (): Promise<Blog[]> => {
    try {
        const response = await PrivateAxios.get('/blogs');
        return response.data;
    } catch (error) {
        console.error("getBlogs Error", error);
        throw error;
    }
};

export const getBlog = async (id: string): Promise<Blog> => {
    try {
        const response = await PrivateAxios.get(`/blogs/${id}`);
        return response.data;
    } catch (error) {
        console.error("getBlog Error", error);
        throw error;
    }
};

export const createBlog = async (data: Partial<Blog>): Promise<Blog> => {
    try {
        const response = await PrivateAxios.post('/blogs', data);
        return response.data;
    } catch (error) {
        console.error("createBlog Error", error);
        throw error;
    }
};

export const updateBlog = async (id: string, data: Partial<Blog>): Promise<Blog> => {
    try {
        const response = await PrivateAxios.put(`/blogs/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("updateBlog Error", error);
        throw error;
    }
};

export const deleteBlog = async (id: string): Promise<{ message: string }> => {
    try {
        const response = await PrivateAxios.delete(`/blogs/${id}`);
        return response.data;
    } catch (error) {
        console.error("deleteBlog Error", error);
        throw error;
    }
};

export const uploadBlogImage = async (file: File): Promise<{ url: string; key: string }> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await PrivateAxios.post('/blogs/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        console.error("uploadBlogImage Error", error);
        throw error;
    }
};

export const uploadBlogVideo = async (file: File): Promise<{ url: string; key: string }> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await PrivateAxios.post('/blogs/upload-video', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        console.error("uploadBlogVideo Error", error);
        throw error;
    }
};

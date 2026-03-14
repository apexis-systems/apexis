import React, { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';

interface Notification {
    id: number;
    title: string;
    body: string;
    type: string;
    data: any;
    is_read: boolean;
    createdAt: string;
}

const NotificationDropdown = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const { socket, unreadNotificationCount, setUnreadNotificationCount } = useSocket();

    const fetchNotifications = async () => {
        try {
            const res = await PrivateAxios.get('/notifications');
            setNotifications(res.data.notifications);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();

        if (socket) {
            socket.on('new-notification', (notif: Notification) => {
                setNotifications(prev => [notif, ...prev]);
            });

            return () => {
                socket.off('new-notification');
            };
        }
    }, [socket]);

    const markRead = async (id: number) => {
        try {
            await PrivateAxios.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    const markAllRead = async () => {
        try {
            await PrivateAxios.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadNotificationCount(0);
        } catch (error) {
            console.error('Failed to mark all read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="relative">
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setUnreadNotificationCount(0);
                }}
                className="relative p-2 text-gray-600 hover:text-primary transition-colors focus:outline-none"
            >
                <Bell size={20} />
                {unreadNotificationCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                        <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-[10px] text-primary hover:underline font-medium"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="divide-y divide-gray-50">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors relative ${!notif.is_read ? 'bg-primary/5' : ''}`}
                                        onClick={() => markRead(notif.id)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-900 leading-tight pr-4">{notif.title}</p>
                                            {!notif.is_read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                                        </div>
                                        <p className="text-[11px] text-gray-600 mb-1 leading-snug">{notif.body}</p>
                                        <p className="text-[9px] text-gray-400">
                                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationDropdown;

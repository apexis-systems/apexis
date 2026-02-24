export const mockUser = {
    name: "Jane Doe",
    email: "jane@rhinon.tech",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    storage: {
        used: 45.2, // GB
        total: 100, // GB
        percentage: 45.2,
    },
    tier: "Pro Plan",
};

export const mockFolders = [
    { id: '1', name: 'Design Assets', filesCount: 124, size: '2.4 GB', color: 'bg-indigo-500' },
    { id: '2', name: 'Invoices 2024', filesCount: 45, size: '120 MB', color: 'bg-emerald-500' },
    { id: '3', name: 'Project Alpha', filesCount: 89, size: '1.1 GB', color: 'bg-rose-500' },
    { id: '4', name: 'Personal Docs', filesCount: 12, size: '45 MB', color: 'bg-amber-500' },
];

export const mockRecentFiles = [
    { id: '1', name: 'Q3_Financial_Report.pdf', size: '2.4 MB', type: 'pdf', date: '2 hours ago' },
    { id: '2', name: 'App_Wireframes_v2.fig', size: '45.1 MB', type: 'figma', date: '5 hours ago' },
    { id: '3', name: 'Team_Meeting_Notes.docx', size: '120 KB', type: 'doc', date: 'Yesterday' },
    { id: '4', name: 'Hero_Image_Final.png', size: '4.2 MB', type: 'image', date: 'Yesterday' },
    { id: '5', name: 'Budget_2024.xlsx', size: '1.1 MB', type: 'spreadsheet', date: '2 days ago' },
];

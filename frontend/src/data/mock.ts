import { User, Project, ProjectDocument, ProjectPhoto, Report, Folder, ActivityItem, Comment, SnagItem, ManualSOP } from '@/types';

export const mockUsers: Record<string, User> = {
    superadmin: {
        id: 'u0',
        name: 'Super Admin User',
        email: 'superadmin@apexis.in',
        role: 'superadmin',
        active: true,
    },
    admin: {
        id: 'u1',
        name: 'Rajesh Kumar',
        email: 'rajesh@apexis.in',
        role: 'admin',
        active: true,
    },
    contributor: {
        id: 'u2',
        name: 'Priya Sharma',
        email: 'priya@apexis.in',
        role: 'contributor',
        active: true,
    },
    client: {
        id: 'u3',
        name: 'Vikram Reddy',
        email: 'vikram@client.com',
        role: 'client',
        active: true,
    },
};

export const mockAllUsers: User[] = [
    { id: 'u0', name: 'Super Admin User', email: 'superadmin@apexis.in', role: 'superadmin', active: true },
    { id: 'u1', name: 'Rajesh Kumar', email: 'rajesh@apexis.in', role: 'admin', active: true },
    { id: 'u2', name: 'Priya Sharma', email: 'priya@apexis.in', role: 'contributor', active: true },
    { id: 'u3', name: 'Vikram Reddy', email: 'vikram@client.com', role: 'client', active: true },
    { id: 'u4', name: 'Anita Desai', email: 'anita@apexis.in', role: 'contributor', active: false },
    { id: 'u5', name: 'Suresh Patel', email: 'suresh@client.com', role: 'client', active: true },
];

export const mockProjects: Project[] = [
    {
        id: 'p1',
        name: 'Jubilee Hills Residence',
        location: 'Jubilee Hills, Hyderabad',
        startDate: '2025-01-15',
        endDate: '2026-06-30',
        color: 'hsl(32, 95%, 52%)',
        totalDocs: 24,
        totalPhotos: 156,
        assignedTo: ['u2'],
        sharedWith: ['u3'],
    },
    {
        id: 'p2',
        name: 'Banjara Hills Villa',
        location: 'Banjara Hills, Hyderabad',
        startDate: '2025-03-01',
        endDate: '2026-09-15',
        color: 'hsl(0, 0%, 20%)',
        totalDocs: 18,
        totalPhotos: 89,
        assignedTo: ['u2'],
        sharedWith: ['u3'],
    },
    {
        id: 'p3',
        name: 'Red Hills Commercial',
        location: 'Red Hills, Chennai',
        startDate: '2025-06-10',
        endDate: '2027-01-20',
        color: 'hsl(32, 80%, 42%)',
        totalDocs: 7,
        totalPhotos: 34,
        assignedTo: [],
        sharedWith: [],
    },
    {
        id: 'p4',
        name: 'Gachibowli Office Tower',
        location: 'Gachibowli, Hyderabad',
        startDate: '2024-11-01',
        endDate: '2026-04-30',
        color: 'hsl(0, 0%, 35%)',
        totalDocs: 42,
        totalPhotos: 210,
        assignedTo: [],
        sharedWith: [],
    },
];

export const mockFolders: Folder[] = [
    { id: 'f1', projectId: 'p1', name: 'Structural Drawings', type: 'documents' },
    { id: 'f2', projectId: 'p1', name: 'MEP Drawings', type: 'documents' },
    { id: 'f3', projectId: 'p1', name: 'Architectural Plans', type: 'documents' },
    { id: 'f4', projectId: 'p2', name: 'Site Plans', type: 'documents' },
    { id: 'f5', projectId: 'p2', name: 'Floor Plans', type: 'documents' },
    { id: 'f6', projectId: 'p1', name: 'Foundation Work', type: 'photos' },
    { id: 'f7', projectId: 'p1', name: 'Site Progress', type: 'photos' },
    { id: 'f8', projectId: 'p1', name: 'Safety Inspections', type: 'photos' },
    { id: 'f9', projectId: 'p2', name: 'Exterior Work', type: 'photos' },
    { id: 'f10', projectId: 'p2', name: 'Landscaping', type: 'photos' },
];

export const mockDocuments: ProjectDocument[] = [
    { id: 'd1', projectId: 'p1', folderId: 'f1', name: 'Foundation Plan v3.pdf', type: 'pdf', uploadDate: '2025-08-12', uploader: 'Rajesh Kumar', uploaderId: 'u1', version: 3, clientVisible: true, size: '2.4 MB' },
    { id: 'd2', projectId: 'p1', folderId: 'f1', name: 'Structural Drawing.dwg', type: 'dwg', uploadDate: '2025-09-05', uploader: 'Priya Sharma', uploaderId: 'u2', version: 1, clientVisible: false, size: '8.1 MB' },
    { id: 'd3', projectId: 'p1', folderId: 'f2', name: 'Electrical Layout.pdf', type: 'pdf', uploadDate: '2025-10-18', uploader: 'Rajesh Kumar', uploaderId: 'u1', version: 2, clientVisible: true, size: '1.7 MB' },
    { id: 'd4', projectId: 'p1', folderId: 'f2', name: 'Plumbing Plan.dwg', type: 'dwg', uploadDate: '2025-11-02', uploader: 'Priya Sharma', uploaderId: 'u2', version: 1, clientVisible: false, size: '5.3 MB' },
    { id: 'd5', projectId: 'p2', folderId: 'f4', name: 'Site Plan.pdf', type: 'pdf', uploadDate: '2025-07-20', uploader: 'Rajesh Kumar', uploaderId: 'u1', version: 2, clientVisible: true, size: '3.2 MB' },
    { id: 'd6', projectId: 'p2', folderId: 'f5', name: 'Floor Plan Ground.dwg', type: 'dwg', uploadDate: '2025-08-15', uploader: 'Rajesh Kumar', uploaderId: 'u1', version: 1, clientVisible: true, size: '6.7 MB' },
];

export const mockPhotos: ProjectPhoto[] = [
    { id: 'ph1', projectId: 'p1', folderId: 'f6', url: '', date: '2025-11-20', location: 'Block A - Ground Floor', tags: ['foundation', 'concrete'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: true },
    { id: 'ph2', projectId: 'p1', folderId: 'f6', url: '', date: '2025-11-18', location: 'Block A - Basement', tags: ['excavation'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: true },
    { id: 'ph3', projectId: 'p1', folderId: 'f7', url: '', date: '2025-11-15', location: 'Block B - Foundation', tags: ['rebar', 'formwork'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: false },
    { id: 'ph4', projectId: 'p1', folderId: 'f8', url: '', date: '2025-11-10', location: 'Site Entry', tags: ['safety', 'equipment'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: true },
    { id: 'ph5', projectId: 'p2', folderId: 'f9', url: '', date: '2025-10-25', location: 'Main Gate', tags: ['entrance', 'landscaping'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: true },
    { id: 'ph6', projectId: 'p2', folderId: 'f10', url: '', date: '2025-10-20', location: 'Pool Area', tags: ['excavation', 'drainage'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: false },
    { id: 'ph7', projectId: 'p1', folderId: 'f6', url: '', date: '2025-11-19', location: 'Block A - Level 1', tags: ['concrete'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: true },
    { id: 'ph8', projectId: 'p1', folderId: 'f6', url: '', date: '2025-11-17', location: 'Block A - Level 2', tags: ['formwork'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: true },
    { id: 'ph9', projectId: 'p1', folderId: 'f7', url: '', date: '2025-11-16', location: 'Block B - Level 1', tags: ['rebar'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: true },
    { id: 'ph10', projectId: 'p1', folderId: 'f7', url: '', date: '2025-11-14', location: 'Block C - Foundation', tags: ['excavation'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: true },
    { id: 'ph11', projectId: 'p1', folderId: 'f8', url: '', date: '2025-11-13', location: 'Main Entry', tags: ['safety'], uploader: 'Priya Sharma', uploaderId: 'u2', clientVisible: true },
    { id: 'ph12', projectId: 'p1', folderId: 'f8', url: '', date: '2025-11-12', location: 'Equipment Area', tags: ['equipment'], uploader: 'Rajesh Kumar', uploaderId: 'u1', clientVisible: false },
];

export const mockReports: Report[] = [
    { id: 'r1', projectId: 'p1', title: 'Daily Site Report — Nov 20', type: 'daily', date: '2025-11-20', uploader: 'Priya Sharma' },
    { id: 'r2', projectId: 'p1', title: 'Daily Site Report — Nov 19', type: 'daily', date: '2025-11-19', uploader: 'Priya Sharma' },
    { id: 'r3', projectId: 'p1', title: 'Weekly Progress — Week 47', type: 'weekly', date: '2025-11-17', uploader: 'Rajesh Kumar' },
    { id: 'r4', projectId: 'p1', title: 'Daily Site Report — Nov 14', type: 'daily', date: '2025-11-14', uploader: 'Priya Sharma' },
    { id: 'r5', projectId: 'p2', title: 'Weekly Progress — Week 43', type: 'weekly', date: '2025-10-26', uploader: 'Rajesh Kumar' },
    { id: 'r6', projectId: 'p2', title: 'Daily Site Report — Oct 25', type: 'daily', date: '2025-10-25', uploader: 'Priya Sharma' },
];

export const mockActivities: ActivityItem[] = [
    { id: 'a1', type: 'upload', description: 'Foundation Plan v3.pdf uploaded', projectName: 'Jubilee Hills Residence', timestamp: '2 hours ago' },
    { id: 'a2', type: 'edit', description: 'Structural Drawing.dwg updated', projectName: 'Jubilee Hills Residence', timestamp: '5 hours ago' },
    { id: 'a3', type: 'share', description: 'Site photos shared with client', projectName: 'Banjara Hills Villa', timestamp: '1 day ago' },
    { id: 'a4', type: 'upload', description: '12 new site photos added', projectName: 'Jubilee Hills Residence', timestamp: '1 day ago' },
    { id: 'a5', type: 'delete', description: 'Old draft removed', projectName: 'Red Hills Commercial', timestamp: '2 days ago' },
];

export const mockComments: Comment[] = [
    { id: 'c1', targetId: 'd1', targetType: 'document', userId: 'u1', userName: 'Rajesh Kumar', text: 'Please review the updated foundation plan.', timestamp: '2 hours ago' },
    { id: 'c2', targetId: 'd1', targetType: 'document', userId: 'u2', userName: 'Priya Sharma', text: 'Reviewed. Looks good. Minor change needed on section B.', timestamp: '1 hour ago', parentId: 'c1' },
    { id: 'c3', targetId: 'ph1', targetType: 'photo', userId: 'u2', userName: 'Priya Sharma', text: 'Ground floor concrete pour completed.', timestamp: '3 hours ago' },
];

export const mockSnags: SnagItem[] = [
    { id: 's1', projectId: 'p1', title: 'Fix waterproofing in basement', description: 'Water seepage visible on east wall of basement level 2', photoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'amber', comments: ['Waiting for material delivery'], createdAt: '2025-11-18' },
    { id: 's2', projectId: 'p1', title: 'Repaint entrance lobby', description: 'Paint peeling near the ceiling corners', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'green', comments: ['Completed on Nov 19'], createdAt: '2025-11-15' },
    { id: 's3', projectId: 'p2', title: 'Replace cracked tile in bathroom', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'red', comments: ['No further action needed'], createdAt: '2025-10-20' },
];

export const mockManuals: ManualSOP[] = [
    { id: 'm1', projectId: 'p1', name: 'Ergonomic Standards v2.pdf', type: 'pdf', uploadDate: '2025-09-01', uploader: 'Rajesh Kumar', uploaderId: 'u1', size: '1.2 MB' },
    { id: 'm2', projectId: 'p1', name: 'Finishing Details SOP.pdf', type: 'pdf', uploadDate: '2025-10-15', uploader: 'Rajesh Kumar', uploaderId: 'u1', size: '3.4 MB' },
    { id: 'm3', projectId: 'p2', name: 'Company Safety Protocol.pdf', type: 'pdf', uploadDate: '2025-08-20', uploader: 'Rajesh Kumar', uploaderId: 'u1', size: '2.1 MB' },
];

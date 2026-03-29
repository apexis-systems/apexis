import { User, Project, ProjectDocument, ProjectPhoto, Report, Folder, ActivityItem, Comment, SnagItem, ManualSOP } from '@/types';

export const mockUsers: Record<string, User> = {
    superadmin: {
        id: 'u0',
        name: 'Super Admin User',
        email: 'superadmin@apexis.in',
        role: 'superadmin',
        email_verified: true,
    },
    admin: {
        id: 'u1',
        name: 'Rajesh Kumar',
        email: 'rajesh@apexis.in',
        role: 'admin',
        email_verified: true,
    },
    contributor: {
        id: 'u2',
        name: 'Priya Sharma',
        email: 'priya@apexis.in',
        role: 'contributor',
        email_verified: true,
    },
    client: {
        id: 'u3',
        name: 'Vikram Reddy',
        email: 'vikram@client.com',
        role: 'client',
        email_verified: true,
    },
};

export const mockAllUsers: User[] = [
    { id: 'u0', name: 'Super Admin User', email: 'superadmin@apexis.in', role: 'superadmin', email_verified: true },
    { id: 'u1', name: 'Rajesh Kumar', email: 'rajesh@apexis.in', role: 'admin', email_verified: true },
    { id: 'u2', name: 'Priya Sharma', email: 'priya@apexis.in', role: 'contributor', email_verified: true },
    { id: 'u3', name: 'Vikram Reddy', email: 'vikram@client.com', role: 'client', email_verified: true },
    { id: 'u4', name: 'Anita Desai', email: 'anita@apexis.in', role: 'contributor', email_verified: false },
    { id: 'u5', name: 'S सुरेश Patel', email: 's सुरेश@client.com', role: 'client', email_verified: true },
];

export const mockProjects: Project[] = [
    {
        id: 'p1',
        name: 'Jubilee Hills Residence',
        location: 'Jubilee Hills, Hyderabad',
        start_date: '2025-01-15',
        end_date: '2026-06-30',
        color: 'hsl(32, 95%, 52%)',
        totalDocs: 24,
        totalPhotos: 156,
        assignedTo: ['u2'],
        sharedWith: ['u3'],
        contributor_code: 'JUB-CONT-01',
        client_code: 'JUB-CLNT-01',
    },
    {
        id: 'p2',
        name: 'Banjara Hills Villa',
        location: 'Banjara Hills, Hyderabad',
        start_date: '2025-03-01',
        end_date: '2026-09-15',
        color: 'hsl(0, 0%, 20%)',
        totalDocs: 18,
        totalPhotos: 89,
        assignedTo: ['u2'],
        sharedWith: ['u3'],
        contributor_code: 'BAN-CONT-01',
        client_code: 'BAN-CLNT-01',
    },
    {
        id: 'p3',
        name: 'Red Hills Commercial',
        location: 'Red Hills, Chennai',
        start_date: '2025-06-10',
        end_date: '2027-01-20',
        color: 'hsl(32, 80%, 42%)',
        totalDocs: 7,
        totalPhotos: 34,
        assignedTo: [],
        sharedWith: [],
        contributor_code: 'RED-CONT-01',
        client_code: 'RED-CLNT-01',
    },
    {
        id: 'p4',
        name: 'Gachibowli Office Tower',
        location: 'Gachibowli, Hyderabad',
        start_date: '2024-11-01',
        end_date: '2026-04-30',
        color: 'hsl(0, 0%, 35%)',
        totalDocs: 42,
        totalPhotos: 210,
        assignedTo: [],
        sharedWith: [],
        contributor_code: 'GAC-CONT-01',
        client_code: 'GAC-CLNT-01',
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
    { id: 'd1', project_id: 'p1', folder_id: 'f1', file_name: 'Foundation Plan v3.pdf', file_type: 'pdf', createdAt: '2025-08-12', created_by: 'u1', downloadUrl: '', client_visible: true, file_size_mb: 2.4 },
    { id: 'd2', project_id: 'p1', folder_id: 'f1', file_name: 'Structural Drawing.dwg', file_type: 'dwg', createdAt: '2025-09-05', created_by: 'u2', downloadUrl: '', client_visible: false, file_size_mb: 8.1 },
    { id: 'd3', project_id: 'p1', folder_id: 'f2', file_name: 'Electrical Layout.pdf', file_type: 'pdf', createdAt: '2025-10-18', created_by: 'u1', downloadUrl: '', client_visible: true, file_size_mb: 1.7 },
    { id: 'd4', project_id: 'p1', folder_id: 'f2', file_name: 'Plumbing Plan.dwg', file_type: 'dwg', createdAt: '2025-11-02', created_by: 'u2', downloadUrl: '', client_visible: false, file_size_mb: 5.3 },
    { id: 'd5', project_id: 'p2', folder_id: 'f4', file_name: 'Site Plan.pdf', file_type: 'pdf', createdAt: '2025-07-20', created_by: 'u1', downloadUrl: '', client_visible: true, file_size_mb: 3.2 },
    { id: 'd6', project_id: 'p2', folder_id: 'f5', file_name: 'Floor Plan Ground.dwg', file_type: 'dwg', createdAt: '2025-08-15', created_by: 'u1', downloadUrl: '', client_visible: true, file_size_mb: 6.7 },
];

export const mockPhotos: ProjectPhoto[] = [
    { id: 'ph1', project_id: 'p1', folder_id: 'f6', downloadUrl: '', createdAt: '2025-11-20', location: 'Block A - Ground Floor', tags: ['foundation', 'concrete'], created_by: 'u2', client_visible: true, file_name: 'photo1.jpg', file_type: 'jpg', file_size_mb: 1.2 },
    { id: 'ph2', project_id: 'p1', folder_id: 'f6', downloadUrl: '', createdAt: '2025-11-18', location: 'Block A - Basement', tags: ['excavation'], created_by: 'u1', client_visible: true, file_name: 'photo2.jpg', file_type: 'jpg', file_size_mb: 1.1 },
    { id: 'ph3', project_id: 'p1', folder_id: 'f7', downloadUrl: '', createdAt: '2025-11-15', location: 'Block B - Foundation', tags: ['rebar', 'formwork'], created_by: 'u2', client_visible: false, file_name: 'photo3.jpg', file_type: 'jpg', file_size_mb: 1.3 },
    { id: 'ph4', project_id: 'p1', folder_id: 'f8', downloadUrl: '', createdAt: '2025-11-10', location: 'Site Entry', tags: ['safety', 'equipment'], created_by: 'u1', client_visible: true, file_name: 'photo4.jpg', file_type: 'jpg', file_size_mb: 1.4 },
    { id: 'ph5', project_id: 'p2', folder_id: 'f9', downloadUrl: '', createdAt: '2025-10-25', location: 'Main Gate', tags: ['entrance', 'landscaping'], created_by: 'u2', client_visible: true, file_name: 'photo5.jpg', file_type: 'jpg', file_size_mb: 1.5 },
    { id: 'ph6', project_id: 'p2', folder_id: 'f10', downloadUrl: '', createdAt: '2025-10-20', location: 'Pool Area', tags: ['excavation', 'drainage'], created_by: 'u1', client_visible: false, file_name: 'photo6.jpg', file_type: 'jpg', file_size_mb: 1.6 },
    { id: 'ph7', project_id: 'p1', folder_id: 'f6', downloadUrl: '', createdAt: '2025-11-19', location: 'Block A - Level 1', tags: ['concrete'], created_by: 'u2', client_visible: true, file_name: 'photo7.jpg', file_type: 'jpg', file_size_mb: 1.2 },
    { id: 'ph8', project_id: 'p1', folder_id: 'f6', downloadUrl: '', createdAt: '2025-11-17', location: 'Block A - Level 2', tags: ['formwork'], created_by: 'u1', client_visible: true, file_name: 'photo8.jpg', file_type: 'jpg', file_size_mb: 1.1 },
    { id: 'ph9', project_id: 'p1', folder_id: 'f7', downloadUrl: '', createdAt: '2025-11-16', location: 'Block B - Level 1', tags: ['rebar'], created_by: 'u2', client_visible: true, file_name: 'photo9.jpg', file_type: 'jpg', file_size_mb: 1.3 },
    { id: 'ph10', project_id: 'p1', folder_id: 'f7', downloadUrl: '', createdAt: '2025-11-14', location: 'Block C - Foundation', tags: ['excavation'], created_by: 'u1', client_visible: true, file_name: 'photo10.jpg', file_type: 'jpg', file_size_mb: 1.4 },
    { id: 'ph11', project_id: 'p1', folder_id: 'f8', downloadUrl: '', createdAt: '2025-11-13', location: 'Main Entry', tags: ['safety'], created_by: 'u2', client_visible: true, file_name: 'photo11.jpg', file_type: 'jpg', file_size_mb: 1.5 },
    { id: 'ph12', project_id: 'p1', folder_id: 'f8', downloadUrl: '', createdAt: '2025-11-12', location: 'Equipment Area', tags: ['equipment'], created_by: 'u1', client_visible: false, file_name: 'photo12.jpg', file_type: 'jpg', file_size_mb: 1.6 },
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
    { id: 'a4', type: 'upload_photo', description: '12 new site photos added', projectName: 'Jubilee Hills Residence', timestamp: '1 day ago' },
    { id: 'a5', type: 'delete', description: 'Old draft removed', projectName: 'Red Hills Commercial', timestamp: '2 days ago' },
];

export const mockComments: Comment[] = [
    { id: 'c1', targetId: 'd1', targetType: 'document', userId: 'u1', userName: 'Rajesh Kumar', text: 'Please review the updated foundation plan.', timestamp: '2 hours ago' },
    { id: 'c2', targetId: 'd1', targetType: 'document', userId: 'u2', userName: 'Priya Sharma', text: 'Reviewed. Looks good. Minor change needed on section B.', timestamp: '1 hour ago', parentId: 'c1' },
    { id: 'c3', targetId: 'ph1', targetType: 'photo', userId: 'u2', userName: 'Priya Sharma', text: 'Ground floor concrete pour completed.', timestamp: '3 hours ago' },
];

export const mockSnags: SnagItem[] = [
    { id: 's1', projectId: 'p1', title: 'Fix waterproofing in basement', description: 'Water seepage visible on east wall of basement level 2', photoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'amber', comments: ['Waiting for material delivery'], createdAt: '2025-11-18', created_by: 'u1' },
    { id: 's2', projectId: 'p1', title: 'Repaint entrance lobby', description: 'Paint peeling near the ceiling corners', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'green', comments: ['Completed on Nov 19'], createdAt: '2025-11-15', created_by: 'u1' },
    { id: 's3', projectId: 'p2', title: 'Replace cracked tile in bathroom', assignedTo: 'u2', assignedToName: 'Priya Sharma', status: 'red', comments: ['No further action needed'], createdAt: '2025-10-20', created_by: 'u1' },
];

export const mockManuals: ManualSOP[] = [
    { id: 'm1', projectId: 'p1', name: 'Ergonomic Standards v2.pdf', type: 'pdf', uploadDate: '2025-09-01', uploader: 'Rajesh Kumar', uploaded_by: 'u1', size: '1.2 MB' },
    { id: 'm2', projectId: 'p1', name: 'Finishing Details SOP.pdf', type: 'pdf', uploadDate: '2025-10-15', uploader: 'Rajesh Kumar', uploaded_by: 'u1', size: '3.4 MB' },
    { id: 'm3', projectId: 'p2', name: 'Company Safety Protocol.pdf', type: 'pdf', uploadDate: '2025-08-20', uploader: 'Rajesh Kumar', uploaded_by: 'u1', size: '2.1 MB' },
];

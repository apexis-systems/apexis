import { getIO } from '../socket.ts';
import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from '../models/index.ts';
import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument, PDFName, PDFArray } from 'pdf-lib';
import os from 'os';
import { sendNotification } from '../utils/notificationUtils.ts';

export const activeExports = new Map<number, { startTime: number, statusText: string, etaMs?: number }>();

const { projects, folders, files } = db;

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";

const fetchS3Buffer = async (fileKey: string): Promise<Buffer> => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
    });
    const s3Item = await s3Client.send(command);
    if (!s3Item.Body) throw new Error("Empty S3 Body");

    if (typeof (s3Item.Body as any).transformToByteArray === 'function') {
        const u8Arr = await (s3Item.Body as any).transformToByteArray();
        return Buffer.from(u8Arr);
    } else if (typeof (s3Item.Body as any).transformToWebStream === 'function') {
        const webStream = (s3Item.Body as any).transformToWebStream();
        const reader = webStream.getReader();
        const chunks: any[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        return Buffer.concat(chunks);
    }
    
    // Node.js stream fallback
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        (s3Item.Body as any).on('data', (chunk: any) => chunks.push(chunk));
        (s3Item.Body as any).on('error', reject);
        (s3Item.Body as any).on('end', () => resolve(Buffer.concat(chunks)));
    });
};

export const startExportProcess = async (projectId: number, userId: number, orgId: number) => {
    const io = getIO();
    const userRoom = `user-${userId}`;
    const startTime = Date.now();

    let estimatedTotalMs = 0;

    const emitStatus = (status: string, statusType: 'progress' | 'success' | 'failed' = 'progress', extraPayload: any = {}) => {
        const payload: any = { projectId, status, statusType, ...extraPayload };
        if (estimatedTotalMs > 0) {
            payload.etaMs = Math.max(0, estimatedTotalMs - (Date.now() - startTime));
        }

        if (statusType === 'progress') {
            activeExports.set(projectId, { startTime, statusText: status, etaMs: payload.etaMs });
        } else {
            activeExports.delete(projectId);
        }
        io.to(userRoom).emit('export-status', payload);
    };

    try {
        emitStatus('Starting export...');

        const targetProject = await projects.findByPk(projectId);
        const projectName = targetProject?.name || 'Project';

        const allFolders = await folders.findAll({ where: { project_id: projectId } });
        const allFiles = await files.findAll({ where: { project_id: projectId } });

        const folderMap = new Map();
        allFolders.forEach((f: any) => folderMap.set(f.id, f));

        const getFolderPath = (folderId: number | null): string => {
            if (!folderId) return `/${projectName}`;
            const f = folderMap.get(folderId);
            if (!f) return `/${projectName}`;
            return getFolderPath(f.parent_id) + '/' + f.name;
        };

        const imageFiles: any[] = [];
        const pdfFiles: any[] = [];
        const countsByFolder = new Map<string, { photos: number, docs: number }>();
        let totalDocs = 0;

        for (const file of allFiles) {
            let folderPath = getFolderPath(file.folder_id);
            // clean up repeated slashes
            folderPath = folderPath.replace(/\/+/g, '/');

            if (!countsByFolder.has(folderPath)) {
                countsByFolder.set(folderPath, { photos: 0, docs: 0 });
            }
            const folderCounts = countsByFolder.get(folderPath)!;

            if (file.file_type.startsWith('image/')) {
                imageFiles.push({ file, folderPath });
                folderCounts.photos++;
            } else {
                folderCounts.docs++;
                totalDocs++;
                
                if (file.file_type === 'application/pdf' || file.file_name.toLowerCase().endsWith('.pdf')) {
                    pdfFiles.push({ file, folderPath });
                }
            }
        }

        const tempDir = os.tmpdir();
        const exportSessionDir = path.join(tempDir, `export-${projectId}-${Date.now()}`);
        fs.mkdirSync(exportSessionDir, { recursive: true });

        const imagesPdfPath = path.join(exportSessionDir, `images.pdf`);
        const docsPdfPath = path.join(exportSessionDir, `docs.pdf`);

        // 1. Concurrent Downloads Phase
        let processedPhotos = 0;
        let processedDocs = 0;
        const totalPhotos = imageFiles.length;
        const totalPdfDocs = pdfFiles.length;
        const totalItems = totalPhotos + totalPdfDocs;

        // Empirical estimation based on user observed load boundaries for massive construction items
        // Base: 30s. Per item: photos ~3.5s (download+pdf drawing), docs ~10.0s (download+pdf merging)
        estimatedTotalMs = 30000 + (totalPhotos * 3500) + (totalPdfDocs * 10000);

        const downloadTasks: { type: 'image' | 'pdf', s3Key: string, localPath: string, data: any }[] = [];

        imageFiles.forEach((img, idx) => {
            downloadTasks.push({ type: 'image', s3Key: img.file.file_url, localPath: path.join(exportSessionDir, `img-${idx}`), data: img });
        });
        pdfFiles.forEach((pdf, idx) => {
            downloadTasks.push({ type: 'pdf', s3Key: pdf.file.file_url, localPath: path.join(exportSessionDir, `pdf-${idx}.pdf`), data: pdf });
        });

        const updateProgress = () => {
            const totalProcessed = processedPhotos + processedDocs;
            emitStatus(`Downloading assets... (Photos: ${processedPhotos}/${totalPhotos}, Docs: ${processedDocs}/${totalPdfDocs})`, 'progress');
        };

        updateProgress();

        // Download in batches of 10
        const batchSize = 10;
        for (let i = 0; i < downloadTasks.length; i += batchSize) {
            const batch = downloadTasks.slice(i, i + batchSize);
            await Promise.all(batch.map(async (task) => {
                try {
                    const buffer = await fetchS3Buffer(task.s3Key);
                    fs.writeFileSync(task.localPath, buffer);
                } catch (err) {
                    console.error(`Failed to download ${task.s3Key}:`, err);
                }
                if (task.type === 'image') processedPhotos++;
                else processedDocs++;
            }));
            updateProgress();
        }

        // 2. Generate Images PDF
        emitStatus('Generating images document...', 'progress');
        await new Promise<void>((resolve, reject) => {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            const stream = fs.createWriteStream(imagesPdfPath);
            doc.pipe(stream);

            (async () => {
                try {
                    for (let i = 0; i < imageFiles.length; i++) {
                        if (i > 0 && i % 4 === 0) doc.addPage();

                        const imgData = imageFiles[i];
                        const imgIndexOnPage = i % 4;
                        const col = imgIndexOnPage % 2;
                        const row = Math.floor(imgIndexOnPage / 2);

                        const x = 30 + col * 270;
                        const y = 30 + row * 390;

                        const localPath = path.join(exportSessionDir, `img-${i}`);
                        if (fs.existsSync(localPath)) {
                            try {
                                doc.image(localPath, x, y, { fit: [260, 360], align: 'center', valign: 'center' });
                                doc.fontSize(10).text(imgData.folderPath, x, y + 365, { width: 260, align: 'center' });
                            } catch (imgErr) {
                                doc.fontSize(10).text(`[Failed to render image: ${imgData.file.file_name}]`, x, y + 180, { width: 260, align: 'center' });
                                doc.fontSize(10).text(imgData.folderPath, x, y + 365, { width: 260, align: 'center' });
                            }
                        } else {
                            doc.fontSize(10).text(`[Image missing: ${imgData.file.file_name}]`, x, y + 180, { width: 260, align: 'center' });
                            doc.fontSize(10).text(imgData.folderPath, x, y + 365, { width: 260, align: 'center' });
                        }
                    }

                    if (imageFiles.length === 0) {
                        doc.fontSize(14).text("No images found in this project.", 50, 50);
                    }

                    doc.end();
                } catch (err) {
                    reject(err);
                }
            })();

            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        // 3. Generate Docs Count PDF
        emitStatus('Generating documents report...', 'progress');
        await new Promise<void>((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = fs.createWriteStream(docsPdfPath);
            doc.pipe(stream);

            doc.fontSize(20).text(`${projectName} - Export Summary`, { align: 'center' });
            doc.moveDown();
            doc.moveDown();

            doc.fontSize(14).text(`Total Site Photos: ${totalPhotos}`);
            doc.fontSize(14).text(`Total Documents: ${totalDocs}`);
            doc.moveDown();

            if (countsByFolder.size > 0) {
                const sortedFolders = Array.from(countsByFolder.keys()).sort();

                // Table 1: Document Folder Statistics
                const docFolders = sortedFolders.filter(f => countsByFolder.get(f)!.docs > 0);
                if (docFolders.length > 0) {
                    doc.fontSize(14).fillColor('#ea8c0a').text('Document Folder Statistics', 50);
                    doc.moveDown(0.5);
                    doc.fontSize(12).fillColor('gray');
                    doc.text('Folder Path', 50, doc.y);
                    doc.text('Count', 480, doc.y - 12); // match header Y
                    doc.moveDown(0.5);
                    doc.fillColor('black');
                    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                    doc.moveDown(0.5);

                    for (const folder of docFolders) {
                        const counts = countsByFolder.get(folder)!;
                        const folderY = doc.y;
                        doc.fontSize(10).text(folder, 50, folderY, { width: 400 });
                        const nextLineY = doc.y;
                        doc.text(counts.docs.toString(), 480, folderY);
                        doc.y = Math.max(nextLineY, folderY + 15);
                        doc.moveDown(0.5);
                    }
                    doc.moveDown();
                }

                // Table 2: Site Photo Folder Statistics
                const photoFolders = sortedFolders.filter(f => countsByFolder.get(f)!.photos > 0);
                if (photoFolders.length > 0) {
                    doc.fontSize(14).fillColor('#ea8c0a').text('Site Photo Folder Statistics', 50);
                    doc.moveDown(0.5);
                    doc.fontSize(12).fillColor('gray');
                    doc.text('Folder Path', 50, doc.y);
                    doc.text('Count', 480, doc.y - 12); // match header Y
                    doc.moveDown(0.5);
                    doc.fillColor('black');
                    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                    doc.moveDown(0.5);

                    for (const folder of photoFolders) {
                        const counts = countsByFolder.get(folder)!;
                        const folderY = doc.y;
                        doc.fontSize(10).text(folder, 50, folderY, { width: 400 });
                        const nextLineY = doc.y;
                        doc.text(counts.photos.toString(), 480, folderY);
                        doc.y = Math.max(nextLineY, folderY + 15);
                        doc.moveDown(0.5);
                    }
                }
            } else {
                doc.text('No files found in this project.');
            }

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        // 4. Merge PDFs
        emitStatus('Assembling final package...', 'progress');
        const mergedPdf = await PDFLibDocument.create();
        
        const imagesPdfBytes = fs.readFileSync(imagesPdfPath);
        const docsPdfBytes = fs.readFileSync(docsPdfPath);

        const imagesDocLib = await PDFLibDocument.load(imagesPdfBytes);
        const docsDocLib = await PDFLibDocument.load(docsPdfBytes);

        // Add docs count pages first, then images
        const copiedDocsPages = await mergedPdf.copyPages(docsDocLib, docsDocLib.getPageIndices());
        copiedDocsPages.forEach((page) => mergedPdf.addPage(page));

        const copiedImagesPages = await mergedPdf.copyPages(imagesDocLib, imagesDocLib.getPageIndices());
        copiedImagesPages.forEach((page) => mergedPdf.addPage(page));

        // Append actual PDF documents
        for (let i = 0; i < pdfFiles.length; i++) {
            const localPath = path.join(exportSessionDir, `pdf-${i}.pdf`);
            if (fs.existsSync(localPath)) {
                try {
                    const pdfBuffer = fs.readFileSync(localPath);
                    const externalPdf = await PDFLibDocument.load(pdfBuffer, { ignoreEncryption: true });
                    
                    const validPageIndices: number[] = [];
                    for (let pIdx = 0; pIdx < externalPdf.getPageCount(); pIdx++) {
                        const page = externalPdf.getPage(pIdx);
                        let isBlank = false;
                        try {
                            const contents = page.node.get(PDFName.of('Contents'));
                            const annots = page.node.get(PDFName.of('Annots'));
                            if (!contents && !annots) {
                                isBlank = true; // Structurally completely empty page (no text, no annotations, no pictures)
                            } else if (contents?.constructor?.name === 'PDFArray' && (contents as any).size() === 0) {
                                if (!annots) isBlank = true;
                            }
                        } catch (err) {}

                        if (!isBlank) {
                            validPageIndices.push(pIdx);
                        }
                    }

                    if (validPageIndices.length > 0) {
                        const copiedExtPages = await mergedPdf.copyPages(externalPdf, validPageIndices);
                        copiedExtPages.forEach((page) => mergedPdf.addPage(page));
                    }
                } catch (pdfErr) {
                    console.error(`Failed to append PDF document: ${pdfFiles[i].file.file_name}`, pdfErr);
                }
            }
        }

        const finalPdfBytes = await mergedPdf.save();

        // 5. Upload to S3
        emitStatus('Uploading final package...', 'progress');
        const s3Key = `projects/${projectId}/exports/handover-${Date.now()}.pdf`;

        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: 'application/pdf',
            Body: finalPdfBytes
        });
        await s3Client.send(uploadCommand);

        // Clean up temp dir
        try {
            fs.rmSync(exportSessionDir, { recursive: true, force: true });
        } catch (e) {
            console.error("Failed to clean up export temp dir", e);
        }

        // Save URL string and generate temporary presigned for local use
        if (targetProject) {
            targetProject.last_export_url = s3Key;
            targetProject.last_export_date = new Date();
            await targetProject.save();
        }

        const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
        const presignedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 7 * 24 * 3600 }); // 7 days

        const totalTimeMs = Date.now() - startTime;

        emitStatus('Export completed successfully!', 'success', {
            presignedUrl,
            s3Key,
            totalTimeMs
        });

        // Send push notification to the user
        try {
            await sendNotification({
                userId,
                title: 'Project Export Ready',
                body: `The final handover package for project "${targetProject?.name || 'Unknown'}" is ready for download.`,
                type: 'export_completed',
                data: {
                    projectId,
                    exportUrl: presignedUrl
                }
            });
        } catch (notifErr) {
            console.error("Failed to send export completion notification:", notifErr);
        }

    } catch (error: any) {
        console.error("Export Service Error:", error);
        emitStatus(`Export failed: ${error.message}`, 'failed');
    }
};

export const generateSingleReportPDF = async (reportId: number): Promise<Buffer> => {
    const report = await db.reports.findByPk(reportId);
    if (!report) throw new Error("Report not found");

    const project = await db.projects.findByPk(report.project_id);
    const projectName = project?.name || 'Project';

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: any[] = [];
    
    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fillColor('#ea8c0a').fontSize(24).text('APEXIS', { align: 'right' });
        doc.fillColor('#000000').fontSize(20).text(`${report.type.toUpperCase()} REPORT`, { align: 'left' });
        doc.fontSize(12).text(`${projectName}`, { align: 'left' });
        doc.fontSize(10).fillColor('gray').text(`Period: ${new Date(report.period_start).toLocaleDateString()} - ${new Date(report.period_end).toLocaleDateString()}`, { align: 'left' });
        doc.moveDown(2);

        // Summary Stats
        doc.fillColor('#000000').fontSize(14).text('Executive Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`• Site Photos Captured: ${report.photos_count}`);
        doc.fontSize(11).text(`• Documents Uploaded: ${report.docs_count}`);
        doc.fontSize(11).text(`• Comments Made: ${report.comments_count}`);
        doc.moveDown(1.5);

        const summary = report.summary || {};

        // Documents Details
        if (summary.document_titles && summary.document_titles.length > 0) {
            doc.fontSize(14).fillColor('#ea8c0a').text('Documents Uploaded');
            doc.moveDown(0.5);
            summary.document_titles.forEach((title: string) => {
                doc.fontSize(10).fillColor('#333').text(`• ${title}`);
            });
            doc.moveDown(1.5);
        }

        // Photo Summary
        if (summary.photo_summary && summary.photo_summary.length > 0) {
            doc.fontSize(14).fillColor('#ea8c0a').text('Photo Capture Summary');
            doc.moveDown(0.5);
            summary.photo_summary.forEach((ps: any) => {
                doc.fontSize(10).fillColor('#333').text(`• ${ps.count} photos by ${ps.user} in folder: ${ps.folder}`);
            });
            doc.moveDown(1.5);
        }

        // RFIs
        if (summary.rfis && summary.rfis.length > 0) {
            doc.fontSize(14).fillColor('#ea8c0a').text('Requests for Information (RFIs)');
            doc.moveDown(0.5);
            summary.rfis.forEach((rfi: any) => {
                doc.fontSize(10).fillColor('#333').text(`• [${rfi.status.toUpperCase()}] ${rfi.title}`);
            });
            doc.moveDown(1.5);
        }

        // Snags
        if (summary.snags && summary.snags.length > 0) {
            doc.fontSize(14).fillColor('#ea8c0a').text('Snag List Updates');
            doc.moveDown(0.5);
            summary.snags.forEach((snag: any) => {
                doc.fontSize(10).fillColor('#333').text(`• [${snag.status.toUpperCase()}] ${snag.title}`);
            });
            doc.moveDown(1.5);
        }

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('gray').text(`Generated via Apexis Construction Management Platform | Page ${i + 1} of ${pageCount}`, 50, 780, { align: 'center' });
        }

        doc.end();
    });
};


import { getIO } from '../socket.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from '../models/index.ts';
import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument, PDFName, PDFArray } from 'pdf-lib';
import os from 'os';
import { sendNotification } from '../utils/notificationUtils.ts';

export const activeExports = new Map<number, { startTime: number, statusText: string, etaMs?: number }>();

const { projects, folders, files, organizations } = db;

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "apexis-bucket";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_PDF_ASSETS_DIR = path.join(__dirname, '../assets');
const REPORT_PDF_ASSETS = {
    logo: path.join(REPORT_PDF_ASSETS_DIR, 'app-icon.png'),
    angelica: path.join(REPORT_PDF_ASSETS_DIR, 'fonts/Angelica-C.otf'),
};

/** Brand palette aligned with Apexis PDF templates (amber / orange accents). */
const BRAND = {
    orange: '#f97415',
    orangeDark: '#c2410c',
    amber: '#fbbf24',
    ink: '#1c1917',
    muted: '#78716c',
    line: '#e7e5e4',
    /** Navy table head (matches sample PDFs). */
    tableHeader: '#0f172a',
    tableRowAlt: '#f4f4f5',
};

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
                        } catch (err) { }

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

/** --- SHARED PDF LAYOUT HELPERS --- */

const drawBrandedHeader = (doc: any, titleStr: string, taglineStr: string, compact: boolean = false) => {
    const hasLogo = fs.existsSync(REPORT_PDF_ASSETS.logo);
    const hasAngelica = fs.existsSync(REPORT_PDF_ASSETS.angelica);
    const brandFont = hasAngelica ? 'Angelica' : 'Helvetica-Bold';
    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const r = pageW - doc.page.margins.right;

    // Top orange accent (commented out as per previous manual edit)
    // doc.save().rect(0, 0, pageW, 5).fill(BRAND.orange).restore();

    // Centered Logo & Brand
    const logoH = 32;
    const blockTop = 15;
    doc.font(brandFont).fontSize(20);
    const brandTextW = doc.widthOfString('APEXIS');
    doc.font('Helvetica-Bold').fontSize(5.5);
    const tagW = doc.widthOfString(taglineStr);
    const gap = 10;
    const clusterW = (hasLogo ? logoH + gap : 0) + Math.max(brandTextW, tagW);
    const clusterLeft = (pageW - clusterW) / 2;

    let textLeft = clusterLeft;
    if (hasLogo) {
        try {
            doc.image(REPORT_PDF_ASSETS.logo, clusterLeft, blockTop, { height: logoH });
        } catch (e) { /* ignore */ }
        textLeft = clusterLeft + logoH + gap;
    }

    doc.font(brandFont).fontSize(20).fillColor(BRAND.orange);
    doc.text('APEXIS', textLeft, blockTop + 4, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(BRAND.muted);
    // Moved from +24 to +28 to increase the vertical gap with the BRAND text (as per user tweak)
    doc.text(taglineStr, textLeft + (brandTextW - tagW) / 2 + 3, blockTop + 28, { lineBreak: false });

    if (!compact) {
        // Header Rule
        const ruleY = 60;
        doc.moveTo(left, ruleY).lineTo(r, ruleY).strokeColor(BRAND.orange).lineWidth(1.2).stroke();

        // Center Title below rule
        doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND.ink);
        doc.text(titleStr.toUpperCase(), left, ruleY + 12, { width: r - left, align: 'center' });
        doc.y = ruleY + 35;
    } else {
        const ruleY = 60;
        doc.moveTo(left, ruleY).lineTo(r, ruleY).strokeColor(BRAND.orange).lineWidth(1.2).stroke();
        doc.y = ruleY + 10;
    }
};

const drawMonthlyCoverPage = (doc: any, project: any, report: any, orgName: string) => {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const hasLogo = fs.existsSync(REPORT_PDF_ASSETS.logo);
    const hasAngelica = fs.existsSync(REPORT_PDF_ASSETS.angelica);
    const brandFont = hasAngelica ? 'Angelica' : 'Helvetica-Bold';
    const monthStr = new Date(report.period_start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();

    // Full-page background (Stone/Beige) with 70% opacity
    doc.save().rect(0, 0, pageWidth, pageHeight).fillOpacity(0.7).fill('#d6d3d1').restore();

    // Top & Bottom Accent
    doc.save().rect(0, 0, pageWidth, 8).fill(BRAND.orange).restore();
    doc.save().rect(0, pageHeight - 8, pageWidth, 8).fill(BRAND.orange).restore();

    // Branding Cluster (Centered)
    const logoH = 64;
    const blockTop = 100;
    doc.font(brandFont).fontSize(48);
    const brandTextW = doc.widthOfString('APEXIS');
    const taglineStr = 'RECORD · REPORT · RELEASE .';
    doc.font('Helvetica').fontSize(10);
    const tagW = doc.widthOfString(taglineStr);
    const clusterW = Math.max(brandTextW, tagW, hasLogo ? logoH : 0);

    if (hasLogo) {
        try {
            doc.image(REPORT_PDF_ASSETS.logo, (pageWidth - logoH) / 2, blockTop, { height: logoH });
        } catch (e) { /* ignore */ }
    }

    doc.font(brandFont).fontSize(48).fillColor(BRAND.orange);
    doc.text('APEXIS', (pageWidth - brandTextW) / 2, blockTop + logoH + 20, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.muted);
    doc.text(taglineStr, (pageWidth - tagW) / 2, blockTop + logoH + 85, { lineBreak: false });

    // Title Block
    doc.save().moveTo(pageWidth * 0.35, blockTop + logoH + 115).lineTo(pageWidth * 0.65, blockTop + logoH + 115).strokeColor(BRAND.orange).lineWidth(1.5).stroke().restore();

    doc.font('Helvetica-Bold').fontSize(34).fillColor(BRAND.tableHeader);
    const title1 = 'MONTHLY PROJECT';
    const title2 = 'REPORT';
    doc.text(title1, 0, blockTop + logoH + 145, { width: pageWidth, align: 'center' });
    doc.text(title2, 0, blockTop + logoH + 185, { width: pageWidth, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND.orange);
    doc.text(monthStr, 0, blockTop + logoH + 235, { width: pageWidth, align: 'center' });

    // Info Box (Large artistic style)
    const boxW = pageWidth * 0.8;
    const boxX = (pageWidth - boxW) / 2;
    const boxY = blockTop + logoH + 280;
    const boxH = 200;

    doc.save().roundedRect(boxX, boxY, boxW, boxH, 15).fill('#d6d3d1').restore();

    const drawLine = (label: string, value: string, yPos: number) => {
        doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text(label, boxX + 40, yPos);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.tableHeader).text(value || ' ', boxX + 180, yPos, { width: boxW - 220, ellipsis: true });
    };

    const s = (report.summary || {}) as any;
    drawLine('Project', project?.name || ' ', boxY + 30);
    drawLine('Client', (s.client || []).join(', ') || ' ', boxY + 65);
    drawLine('Consultant', s.consultant || orgName, boxY + 100);
    drawLine('Contributors', (s.contributors || []).join(', ') || ' ', boxY + 135);
    drawLine('Period', monthStr, boxY + 170);

    // Footer Platform Title
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.muted).text('CONSTRUCTION COMMUNICATION PLATFORM', 0, pageHeight - 50, { width: pageWidth, align: 'center', lineBreak: false });
};

const drawInfoBox = (doc: any, x: number, y: number, w: number, label: string, value: string) => {
    const h = 34;
    doc.save();
    doc.roundedRect(x, y, w, h, 7).fill('#f4f4f5');
    // doc.roundedRect(x, y, w, h, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(6).fillColor(BRAND.muted).text(label.toUpperCase(), x + 8, y + 6);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.ink).text(value || ' ', x + 8, y + 16, { width: w - 16, height: 14, ellipsis: true });
};

const drawDashboardKPIs = (doc: any, kpis: { label: string, value: string | number }[]) => {
    const left = doc.page.margins.left;
    const r = doc.page.width - doc.page.margins.right;
    const w = r - left;
    const gap = 12;
    const n = kpis.length;
    const boxW = (w - gap * (n - 1)) / n;
    const y0 = doc.y;
    const boxH = 68;

    kpis.forEach((k, i) => {
        const x = left + i * (boxW + gap);
        doc.save().roundedRect(x, y0, boxW, boxH, 8).fill(BRAND.tableRowAlt).restore();

        doc.font('Helvetica-Bold').fontSize(24).fillColor(BRAND.orange).text(String(k.value || '0'), x, y0 + 16, { width: boxW, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.muted).text(k.label.toUpperCase(), x, y0 + 44, { width: boxW, align: 'center' });
    });
    doc.y = y0 + boxH + 25; // More breathing room below the dashboard
};

const drawMonthlyDashboard = (doc: any, kpis: { label: string, value: string | number }[]) => {
    const left = doc.page.margins.left;
    const r = doc.page.width - doc.page.margins.right;
    const w = r - left;
    const gap = 12;
    const y0 = doc.y;
    const boxH = 64;
    const boxW = (w - gap) / 2;

    kpis.forEach((k, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = left + col * (boxW + gap);
        const y = y0 + row * (boxH + 8);

        doc.save().roundedRect(x, y, boxW, boxH, 12).fill(BRAND.tableRowAlt).restore();
        doc.font('Helvetica-Bold').fontSize(24).fillColor(BRAND.orange).text(String(k.value || '0'), x, y + 14, { width: boxW, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.muted).text(k.label.toUpperCase(), x, y + 42, { width: boxW, align: 'center' });
    });
    doc.y = y0 + boxH * 2 + 18; // More breathing room below the multi-row dashboard
};

const drawBulletBox = (doc: any, title: string, items: string[], color: string, isRisk: boolean = false) => {
    const left = doc.page.margins.left;
    const r = doc.page.width - doc.page.margins.right;
    const w = r - left;
    const y0 = doc.y;

    // Estimate box height
    const initialY = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.orange).text(title.toUpperCase(), left);
    doc.moveDown(0.5);
    const boxStartY = doc.y;
    const listY = doc.y + 12;

    // Preliminary draw to calculate height
    let currY = listY;
    items.forEach(item => {
        const textH = doc.heightOfString(item, { width: w - 40 });
        currY += textH + 8;
    });

    const boxH = Math.max(60, currY - boxStartY + 10);
    doc.save().roundedRect(left, boxStartY, w, boxH, 10).fill(color).restore();

    doc.y = listY;
    items.forEach(item => {
        const xText = left + 25;
        const yText = doc.y;

        // Bullet
        if (isRisk) {
            doc.save().rect(left + 12, yText + 2, 6, 6).fill('#854d0e').restore(); // Square amber/red
        } else {
            doc.save().circle(left + 15, yText + 5, 3).fill(BRAND.ink).restore(); // Circle navy
        }

        doc.font('Helvetica').fontSize(9).fillColor(BRAND.ink).text(item, xText, yText, { width: w - 40 });
        doc.moveDown(0.6);
    });

    doc.y = boxStartY + boxH + 15;
};

const drawStyledTable = (doc: any, title: string, headers: { text: string, w: number }[], rows: any[][]) => {
    const left = doc.page.margins.left;
    const r = doc.page.width - doc.page.margins.right;
    const contentBottom = doc.page.maxY() - 40;

    const ensureSpace = (h: number) => {
        if (doc.y + h > contentBottom) {
            doc.addPage();
            doc.y = 85; // Reserve space for compact header (rule ends at 70, +15px gap)
            return true;
        }
        return false;
    };

    ensureSpace(40);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.orange).text(title.toUpperCase(), left);
    doc.moveDown(0.2);
    const lineY = doc.y;
    doc.moveTo(left, lineY).lineTo(r, lineY).strokeColor(BRAND.line).lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    // Header
    ensureSpace(20);
    const headY = doc.y;
    doc.save().roundedRect(left, headY, r - left, 20, 4).fill(BRAND.tableHeader).restore();
    let currX = left;
    headers.forEach(h => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(h.text, currX + 6, headY + 6, { width: h.w - 12 });
        currX += h.w;
    });
    doc.y = headY + 20;

    // Rows
    if (rows.length === 0) {
        ensureSpace(20);
        doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text('No records found.', left + 6, doc.y + 6);
        doc.y += 20;
    } else {
        rows.forEach((row, i) => {
            const rowH = 20;
            doc.y += 3.5; // Top margin 2
            if (ensureSpace(rowH)) {
                // Redraw table header on new page if needed (simplified here)
            }
            const y = doc.y;
            if (i % 2 !== 1) {
                doc.save().roundedRect(left, y, r - left, rowH, 4).fill(BRAND.tableRowAlt).restore();
            }
            let rowX = left;
            row.forEach((cell, j) => {
                doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.ink).text(String(cell || ' '), rowX + 6, y + 6, { width: headers[j].w - 12, lineBreak: false });
                rowX += headers[j].w;
            });
            doc.y = y + rowH;
        });
    }
    doc.moveDown(1);
};

const drawBrandedFooter = (doc: any, pageIndex: number, totalPages: number) => {
    doc.switchToPage(pageIndex);
    const page = doc.page;
    const pageWidth = page.width;
    const pageHeight = page.height;
    const footerH = 40;
    const footerY = pageHeight - footerH;

    // Fill footer background with color
    doc.save().rect(0, footerY, pageWidth, footerH).fill(BRAND.tableRowAlt).restore();

    const brandFont = fs.existsSync(REPORT_PDF_ASSETS.angelica) ? 'Angelica' : 'Helvetica-Bold';
    const genAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const m = page.margins;
    const textY = footerY + 16; // Perfectly centered for 40px height

    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted);
    const prefix = 'Generated via ';
    const wp = doc.widthOfString(prefix);
    doc.text(prefix, m.left, textY, { lineBreak: false });

    doc.font(brandFont).fontSize(10).fillColor(BRAND.orange);
    const wb = doc.widthOfString('APEXIS');
    // Nudged -2 to align better with the baseline of the other text
    doc.text('APEXIS', m.left + wp, textY - 2.5, { lineBreak: false });

    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted);
    doc.text(' — CONSTRUCTION COMMUNICATION PLATFORM', m.left + wp + wb, textY, { lineBreak: false });

    const pgText = `Page ${pageIndex + 1} of ${totalPages} | ${genAt}`;
    const pgW = doc.widthOfString(pgText);
    doc.text(pgText, pageWidth - m.right - pgW, textY, { lineBreak: false });
};


/** --- DAILY REPORT RENDERER --- */

export const generateDailyReportPDF = async (report: any): Promise<Buffer> => {
    const project = await db.projects.findByPk(report.project_id);
    const organization = await organizations.findByPk(project?.organization_id);
    const orgName = organization?.name || 'Apexis Engineering Consultants';

    const margin = { top: 40, bottom: 40, left: 40, right: 40 };
    const doc = new PDFDocument({ size: 'A4', margins: margin, bufferPages: true });
    const chunks: any[] = [];

    if (fs.existsSync(REPORT_PDF_ASSETS.angelica)) {
        doc.registerFont('Angelica', REPORT_PDF_ASSETS.angelica);
    }

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header Pass
        drawBrandedHeader(doc, 'Daily Project Report', 'RECORD · REPORT · RELEASE');
        const s = (report.summary || {}) as any;

        // Project Info Grid
        const gridY = doc.y + 10;
        const left = margin.left;
        const r = doc.page.width - margin.right;
        const colW = (r - left - 10) / 2;

        const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ' ';

        drawInfoBox(doc, left, gridY, colW, 'Project', project?.name);
        drawInfoBox(doc, left + colW + 10, gridY, colW, 'Contributors', (s.contributors || []).join(', ') || ' ');
        drawInfoBox(doc, left, gridY + 38, colW, 'Client', (s.client || []).join(', ') || ' ');
        drawInfoBox(doc, left + colW + 10, gridY + 38, colW, 'Consultant', s.consultant || orgName);
        drawInfoBox(doc, left, gridY + 76, colW, 'Date', fmtDate(report.period_start));

        doc.y = gridY + 120;

        // Sections
        const summary = (report.summary || {}) as any;

        // 1. Files
        const fileRows = (summary.document_titles || []).map((d: any, i: number) => [i + 1, d.title || ' ', d.user || ' ', d.date || ' ']);
        const fileW = r - left;
        drawStyledTable(doc, 'SECTION 1 - FILES UPLOADED THIS WEEK', [
            { text: '#', w: fileW * 0.08 },
            { text: 'File Name', w: fileW * 0.52 },
            { text: 'Uploaded By', w: fileW * 0.2 },
            { text: 'Date', w: fileW * 0.16 }
        ], fileRows);

        // 2. Photos
        const photoRows = (summary.photo_summary || []).map((ps: any) => [ps.count, ps.user, ps.folder]);
        const photoW = r - left;
        drawStyledTable(doc, 'SECTION 2 - PHOTOS UPLOADED TODAY', [
            { text: 'Qty', w: photoW * 0.15 },
            { text: 'Uploaded By', w: photoW * 0.35 },
            { text: 'Folder', w: photoW * 0.5 }
        ], photoRows);

        // 3. RFIs
        const rfiRows = (summary.rfis || []).map((rfi: any) => [rfi.title || ' ', rfi.status || ' ', rfi.user || ' ']);
        const rfiW = r - left;
        drawStyledTable(doc, 'SECTION 3 - RFIs RAISED TODAY', [
            { text: 'Title', w: rfiW * 0.45 },
            { text: 'Status', w: rfiW * 0.2 },
            { text: 'Raised By', w: rfiW * 0.2 }
        ], rfiRows);

        // 4. Snags
        const snagRows = (summary.snags || []).map((snag: any) => [snag.title || ' ', snag.status || ' ', snag.user || ' ']);
        const snagW = r - left;
        drawStyledTable(doc, 'SECTION 4 - SNAGS CREATED TODAY', [
            { text: 'Title', w: snagW * 0.45 },
            { text: 'Status', w: snagW * 0.2 },
            { text: 'Raised By', w: snagW * 0.2 }
        ], snagRows);

        // Finalize Headers & Footers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            if (i > 0) drawBrandedHeader(doc, 'Daily Project Report', '', i > 0);
            drawBrandedFooter(doc, i, range.count);
        }

        doc.end();
    });
};

/** --- WEEKLY REPORT RENDERER --- */

export const generateWeeklyReportPDF = async (report: any): Promise<Buffer> => {
    const project = await db.projects.findByPk(report.project_id);
    const organization = await organizations.findByPk(project?.organization_id);
    const orgName = organization?.name || 'Apexis Engineering Consultants';

    const margin = { top: 40, bottom: 40, left: 40, right: 40 };
    const doc = new PDFDocument({ size: 'A4', margins: margin, bufferPages: true });
    const chunks: any[] = [];

    if (fs.existsSync(REPORT_PDF_ASSETS.angelica)) {
        doc.registerFont('Angelica', REPORT_PDF_ASSETS.angelica);
    }

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ' ';

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // --- PAGE 1 ---
        drawBrandedHeader(doc, 'Weekly Project Report', 'RECORD · REPORT · RELEASE');

        const left = margin.left;
        const r = doc.page.width - margin.right;
        const colW = (r - left - 10) / 2;
        const gridY = doc.y + 10;

        const s = (report.summary || {}) as any;
        drawInfoBox(doc, left, gridY, colW, 'Project', project?.name);
        drawInfoBox(doc, left + colW + 10, gridY, colW, 'Contributors', (s.contributors || []).join(', ') || ' ');
        drawInfoBox(doc, left, gridY + 38, colW, 'Client', (s.client || []).join(', ') || ' ');
        drawInfoBox(doc, left + colW + 10, gridY + 38, colW, 'Consultant', s.consultant || orgName);
        drawInfoBox(doc, left, gridY + 76, colW, 'Date', `${fmtDate(report.period_start)} — ${fmtDate(report.period_end)}`);

        doc.y = gridY + 120;

        // Section 1 - Dashboard
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.orange).text('SECTION 1 - WEEKLY PROJECT DASHBOARD', left);
        doc.moveDown(0.6);
        drawDashboardKPIs(doc, [
            { label: 'Files Uploaded', value: report.docs_count || 0 },
            { label: 'Pending Approvals', value: report.releases_count || 0 },
            { label: 'Active Consultants', value: 5 } // Sample from image
        ]);

        // Section 2 - Files
        const summary = (report.summary || {}) as any;
        const fileRows = (summary.document_titles || []).map((d: any, i: number) => [i + 1, d.title || ' ', d.user || ' ', d.date || ' ']);
        const fileW = r - left;
        drawStyledTable(doc, 'SECTION 2 - FILES UPLOADED THIS WEEK', [
            { text: '#', w: fileW * 0.08 },
            { text: 'File Name', w: fileW * 0.52 },
            { text: 'Uploaded By', w: fileW * 0.2 },
            { text: 'Date', w: fileW * 0.16 }
        ], fileRows);

        // Section 3 - Photos
        const photoRows = (summary.photo_summary || []).map((ps: any, i: number) => [i + 1, ps.folder, ps.count, ps.user]);
        const photoW = r - left;
        drawStyledTable(doc, 'SECTION 3 - PHOTOS UPLOADED THIS WEEK', [
            { text: '#', w: photoW * 0.08 },
            { text: 'Folder Path', w: photoW * 0.47 },
            { text: 'Count', w: photoW * 0.15 },
            { text: 'Uploaded By', w: photoW * 0.3 }
        ], photoRows);

        // Section 4 — Snags
        const snagRows = (summary.snags || []).map((snag: any) => [snag.title || ' ', snag.user || ' ', snag.status || ' ']);
        drawStyledTable(doc, 'SECTION 4 - SNAGS CREATED THIS WEEK', [
            { text: 'Title', w: fileW * 0.45 },
            { text: 'Raised By', w: fileW * 0.2 },
            { text: 'Status', w: fileW * 0.2 }
        ], snagRows);

        // 3. RFIs
        const rfiRows = (summary.rfis || []).map((rfi: any) => [rfi.title || ' ', rfi.user || ' ', rfi.status || ' ']);
        const rfiW = r - left;
        drawStyledTable(doc, 'SECTION 5 - RFIs RAISED THIS WEEK', [
            { text: 'Title', w: rfiW * 0.45 },
            { text: 'Status', w: rfiW * 0.2 },
            { text: 'Raised By', w: rfiW * 0.2 }
        ], rfiRows);

        // // --- PAGE 2 ---
        // doc.addPage();
        // drawBrandedHeader(doc, 'Weekly Project Report', 'RECORD · REPORT · RELEASE', true);

        // // Section 5 - Key Decisions
        // const decisions = [
        //     'Basement parking layout finalized with 142 car spaces',
        //     'Lift shaft location approved at Grid C-4',
        //     'Electrical routing revised per MEP coordination',
        //     'Facade material changed to ACP cladding (approved by client)'
        // ];
        // drawBulletBox(doc, 'Section 5 — Key Decisions Taken This Week', decisions, BRAND.tableRowAlt);

        // // Section 6 - Risks
        // const risks = [
        //     'Structural inputs pending from consultant — 3 days overdue',
        //     'Facade material approval awaited from client',
        //     'Landscape drawings delayed — impacting Phase 2 timeline'
        // ];
        // drawBulletBox(doc, 'Section 6 — Risks / Attention Items', risks, '#fef9c3', true);

        // Finalize Headers & Footers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            if (i > 0) drawBrandedHeader(doc, 'Weekly Project Report', '', i > 0);
            drawBrandedFooter(doc, i, range.count);
        }

        doc.end();
    });
};

/** --- MONTHLY REPORT RENDERER --- */

export const generateMonthlyReportPDF = async (report: any): Promise<Buffer> => {
    const project = await db.projects.findByPk(report.project_id);
    const organization = await organizations.findByPk(project?.organization_id);
    const orgName = organization?.name || 'Apexis Engineering Consultants';

    const margin = { top: 40, bottom: 40, left: 40, right: 40 };
    const doc = new PDFDocument({ size: 'A4', margins: margin, bufferPages: true });
    const chunks: any[] = [];

    if (fs.existsSync(REPORT_PDF_ASSETS.angelica)) {
        doc.registerFont('Angelica', REPORT_PDF_ASSETS.angelica);
    }

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ' ';
    const monthName = new Date(report.period_start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // --- PAGE 1: COVER ---
        drawMonthlyCoverPage(doc, project, report, orgName);

        // --- PAGE 2 ---
        doc.addPage();
        drawBrandedHeader(doc, 'Monthly Project Report', 'RECORD · REPORT · RELEASE');

        const left = margin.left;
        const r = doc.page.width - margin.right;
        const colW = (r - left - 10) / 2;
        const gridY = doc.y + 10;

        const s = (report.summary || {}) as any;
        drawInfoBox(doc, left, gridY, colW, 'Project', project?.name);
        drawInfoBox(doc, left + colW + 10, gridY, colW, 'Contributors', (s.contributors || []).join(', ') || ' ');
        drawInfoBox(doc, left, gridY + 38, colW, 'Client', (s.client || []).join(', ') || ' ');
        drawInfoBox(doc, left + colW + 10, gridY + 38, colW, 'Consultant', s.consultant || orgName);
        drawInfoBox(doc, left, gridY + 76, colW, 'Date', monthName);

        doc.y = gridY + 120;

        // Section 1 - Dashboard
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.orange).text('SECTION 1 — MONTHLY PROJECT DASHBOARD', left);
        doc.moveDown(0.6);
        drawMonthlyDashboard(doc, [
            { label: 'Total Files Uploaded', value: report.docs_count || 0 },
            { label: 'Total Photos Uploaded', value: report.photos_count || 0 },
            { label: 'RFIs Raised', value: 18 }, // Sample
            { label: 'RFIs Closed', value: 14 } // Sample
        ]);


        const tblW = r - left;
        // Section 2 - Files
        const summary = (report.summary || {}) as any;
        const fileRows = (summary.document_titles || []).slice(0, 10).map((d: any, i: number) => [i + 1, d.title || ' ', d.user || ' ', d.date || ' ']);
        drawStyledTable(doc, 'SECTION 2 — FILES UPLOADED THIS MONTH', [
            { text: '#', w: tblW * 0.08 },
            { text: 'File Name', w: tblW * 0.52 },
            { text: 'Uploaded By', w: tblW * 0.24 },
            { text: 'Date', w: tblW * 0.16 }
        ], fileRows);

        // Section 3 - Photos
        const photoRows = (summary.photo_summary || []).map((ps: any, i: number) => [i + 1, ps.folder, ps.count, ps.user]);
        const photoW = r - left;
        drawStyledTable(doc, 'SECTION 3 — PHOTOS UPLOADED THIS MONTH', [
            { text: '#', w: photoW * 0.08 },
            { text: 'Folder Path', w: photoW * 0.47 },
            { text: 'Count', w: photoW * 0.15 },
            { text: 'Uploaded By', w: photoW * 0.3 }
        ], photoRows);


        // Section 4 - RFIs
        const rfiRows = (summary.rfis || []).map((rfi: any) => [rfi.title || ' ', rfi.user || ' ', rfi.status || ' ']);
        drawStyledTable(doc, 'SECTION 4 — RFI SUMMARY THIS MONTH', [
            { text: 'Description', w: tblW * 0.45 },
            { text: 'Raised By', w: tblW * 0.2 },
            { text: 'Status', w: tblW * 0.2 }
        ], rfiRows);

        // Section 5 - Snags
        const snagRows = (summary.snags || []).map((snag: any) => [snag.title || ' ', snag.user || ' ', snag.status || ' ']);
        drawStyledTable(doc, 'SECTION 5 — SNAG SUMMARY THIS MONTH', [
            { text: 'Description', w: tblW * 0.45 },
            { text: 'Raised By', w: tblW * 0.2 },
            { text: 'Status', w: tblW * 0.2 }
        ], snagRows);


        // // Section 7 - Key Decisions
        // const decisions = [
        //     'Basement parking layout finalized with 142 car spaces',
        //     'Lift shaft location approved at Grid C-4',
        //     'Electrical routing revised per MEP coordination',
        //     'Facade material changed to ACP cladding (approved by client)',
        //     'Landscape contractor shortlisted — final selection next month'
        // ];
        // drawBulletBox(doc, 'Section 7 — Key Decisions Taken This Month', decisions, BRAND.tableRowAlt);

        // // Section 8 - Risks
        // const risks = [
        //     'Structural inputs pending from consultant — 3 days overdue',
        //     'Facade material approval awaited from client',
        //     'Landscape drawings delayed — impacting Phase 2 timeline',
        //     'Plumbing riser conflict with structural beam at Level 4',
        //     'Budget variance of 3.2% on MEP scope — review required'
        // ];
        // drawBulletBox(doc, 'Section 8 — Risks / Attention Items', risks, '#fef9c3', true);


        // Finalize Headers & Footers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            if (i === 0) continue; // No header/footer on cover page
            doc.switchToPage(i);
            if (i > 1) drawBrandedHeader(doc, 'Monthly Project Report', '', i > 1);
            drawBrandedFooter(doc, i, range.count);
        }

        doc.end();
    });
};

export const generateSingleReportPDF = async (
    reportId: number
): Promise<Buffer> => {

    const report = await db.reports.findByPk(reportId);
    console.log("DEBUG: Report Data ->", JSON.stringify(report, null, 2));

    if (!report) {
        throw new Error("Report not found");
    }

    const reportType = report.type as string;

    // Route based on report type
    if (reportType === "daily") {
        return generateDailyReportPDF(report);
    }

    if (reportType === "weekly") {
        return generateWeeklyReportPDF(report);
    }

    if (reportType === "monthly") {
        return generateMonthlyReportPDF(report);
    }

    throw new Error(`Unsupported report type: ${reportType}`);
};


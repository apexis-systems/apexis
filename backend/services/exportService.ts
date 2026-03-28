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

const { projects, folders, files } = db;

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
    orange: '#ea8c0a',
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

    const typeLabel: Record<string, string> = {
        daily: 'Daily Project Report',
        weekly: 'Weekly Project Report',
        monthly: 'Monthly Project Report',
    };
    const typeBadge: Record<string, string> = {
        daily: 'DAILY REPORT',
        weekly: 'WEEKLY REPORT',
        monthly: 'MONTHLY REPORT',
    };

    const reportType = report.type as string;
    const titleMain = (typeLabel[reportType] || 'Project Report').toUpperCase();
    const badgeLabel = typeBadge[reportType] || 'REPORT';

    const hasAngelica = fs.existsSync(REPORT_PDF_ASSETS.angelica);
    const hasLogo = fs.existsSync(REPORT_PDF_ASSETS.logo);
    const brandFont = () => (hasAngelica ? 'Angelica' : 'Helvetica-Bold');

    /** Top clears header rule; bottom reserves space for footer drawn *above* maxY() (see footer pass). */
    const margin = { top: 96, bottom: 64, left: 44, right: 44 };
    const doc = new PDFDocument({ size: 'A4', margins: margin, bufferPages: true });
    const chunks: any[] = [];

    const fmtDate = (d: string | Date) =>
        new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        if (hasAngelica) {
            doc.registerFont('Angelica', REPORT_PDF_ASSETS.angelica);
        }

        const left = margin.left;
        const right = () => doc.page.width - margin.right;
        /** Body must stop above the footer band (footer uses y ≤ maxY so PDFKit does not add a page). */
        const FOOTER_BAND = 34;
        const contentBottom = () => doc.page.maxY() - FOOTER_BAND;

        const ensureSpace = (needed: number) => {
            if (doc.y + needed > contentBottom()) {
                doc.addPage();
            }
        };

        const HEADER_RULE_Y = 82;
        const COMPACT_RULE_Y = 54;
        const TOP_ACCENT_H = 5;
        const taglineStr =
            reportType === 'daily' ? 'RECORD · REPORT · RELEASE' : 'BUILDING · MANAGING · MAINTAINING';

        /**
         * Continuation pages: centered logo + APEXIS + tagline + rule only (matches template).
         * Page 1: full header with badge. Always reset doc.x / doc.y — explicit header text leaves
         * doc.y ~40pt and body would otherwise flow into the header on page 2+.
         */
        const drawPageHeader = (pageIndex: number) => {
            const pageW = doc.page.width;
            const r = right();
            doc.save();
            doc.rect(0, 0, pageW, TOP_ACCENT_H).fill(BRAND.orange);
            doc.restore();

            if (pageIndex > 0) {
                const logoH = 26;
                const blockTop = TOP_ACCENT_H + 6;
                doc.font(brandFont()).fontSize(18);
                const brandTextW = doc.widthOfString('APEXIS');
                doc.font('Helvetica-Bold').fontSize(6.5);
                const tagW = doc.widthOfString(taglineStr);
                const gap = 8;
                const clusterW = (hasLogo ? logoH + gap : 0) + Math.max(brandTextW, tagW);
                const clusterLeft = (pageW - clusterW) / 2;
                let textLeft = clusterLeft;
                if (hasLogo) {
                    try {
                        doc.image(REPORT_PDF_ASSETS.logo, clusterLeft, blockTop, { height: logoH });
                    } catch {
                        /* ignore */
                    }
                    textLeft = clusterLeft + logoH + gap;
                }
                doc.font(brandFont()).fontSize(18).fillColor(BRAND.orange);
                doc.text('APEXIS', textLeft, blockTop + 2, { lineBreak: false });
                doc.font('Helvetica-Bold').fontSize(6.5).fillColor(BRAND.muted);
                doc.text(taglineStr, textLeft + (brandTextW - tagW) / 2, blockTop + 22, { lineBreak: false });
                doc.moveTo(left, COMPACT_RULE_Y)
                    .lineTo(r, COMPACT_RULE_Y)
                    .strokeColor(BRAND.orange)
                    .lineWidth(1.1)
                    .stroke();
            } else {
                const logoH = 40;
                const logoY = TOP_ACCENT_H + 8;
                if (hasLogo) {
                    try {
                        doc.image(REPORT_PDF_ASSETS.logo, left, logoY, { height: logoH });
                    } catch {
                        /* ignore bad image */
                    }
                }
                const brandX = left + (hasLogo ? logoH + 14 : 0);
                doc.font(brandFont())
                    .fontSize(26)
                    .fillColor(BRAND.orange)
                    .text('APEXIS', brandX, logoY + 2, { lineBreak: false });
                doc.font('Helvetica-Bold')
                    .fontSize(7)
                    .fillColor(BRAND.muted)
                    .text(taglineStr, brandX, logoY + 30, { lineBreak: false });

                const badgeW = 124;
                const badgeH = 42;
                const badgeX = r - badgeW;
                const badgeY = TOP_ACCENT_H + 7;
                doc.save();
                doc.lineWidth(0.9).roundedRect(badgeX, badgeY, badgeW, badgeH, 3).fillAndStroke('#fff7ed', BRAND.orange);
                doc.restore();
                let badgeFs = 8.5;
                doc.font('Helvetica-Bold').fontSize(badgeFs).fillColor(BRAND.orangeDark);
                while (doc.widthOfString(badgeLabel) > badgeW - 10 && badgeFs > 6.5) {
                    badgeFs -= 0.5;
                    doc.font('Helvetica-Bold').fontSize(badgeFs);
                }
                const badgeTextW = doc.widthOfString(badgeLabel);
                doc.text(badgeLabel, badgeX + (badgeW - badgeTextW) / 2, badgeY + 15, { lineBreak: false });

                doc.moveTo(left, HEADER_RULE_Y)
                    .lineTo(r, HEADER_RULE_Y)
                    .strokeColor(BRAND.orange)
                    .lineWidth(1.35)
                    .stroke();
            }

            doc.fillColor(BRAND.ink);
            doc.x = left;
            doc.y = margin.top;
        };

        doc.on('pageAdded', () => {
            const idx = doc.bufferedPageRange().count - 1;
            drawPageHeader(idx);
        });
        drawPageHeader(0);

        const drawKpiRow = () => {
            ensureSpace(88);
            const r = right();
            const w = r - left;
            const gap = 8;
            const n = 4;
            const boxW = (w - gap * (n - 1)) / n;
            const kpis = [
                { label: 'Site photos', value: report.photos_count },
                { label: 'Documents', value: report.docs_count },
                { label: 'Client releases', value: (report as any).releases_count ?? 0 },
                { label: 'Comments', value: report.comments_count },
            ];
            const y0 = doc.y;
            kpis.forEach((k, i) => {
                const x = left + i * (boxW + gap);
                doc.save();
                doc.roundedRect(x, y0, boxW, 56, 4).fill('#f4f4f5');
                doc.roundedRect(x, y0, boxW, 56, 4).strokeColor(BRAND.line).lineWidth(0.8).stroke();
                doc.restore();
                doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(k.label.toUpperCase(), x + 8, y0 + 10, {
                    width: boxW - 16,
                });
                doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND.orange).text(String(k.value), x + 8, y0 + 28, {
                    width: boxW - 16,
                });
            });
            doc.y = y0 + 64;
        };

        let sectionIndex = 0;
        const sectionTitle = (t: string) => {
            ensureSpace(40);
            sectionIndex += 1;
            const w = right() - left;
            const label = `SECTION ${sectionIndex} — ${t}`;
            doc.moveDown(0.15);
            doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.orange).text(label, left, doc.y, { width: w });
            const lineY = doc.y + 2;
            doc.moveTo(left, lineY).lineTo(right(), lineY).strokeColor(BRAND.line).lineWidth(0.5).stroke();
            doc.moveDown(0.85);
        };

        const tableHeader = (cols: { w: number; text: string }[]) => {
            ensureSpace(22);
            const y = doc.y;
            let x = left;
            doc.save();
            doc.rect(left, y, right() - left, 18).fill(BRAND.tableHeader);
            doc.restore();
            cols.forEach((c) => {
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(c.text, x + 4, y + 5, { width: c.w - 8 });
                x += c.w;
            });
            doc.y = y + 20;
        };

        const tableRow = (cells: { w: number; text: string }[], alt: boolean) => {
            const pad = 6;
            const maxLines = cells.map((c) => {
                doc.font('Helvetica').fontSize(9).fillColor(BRAND.ink);
                return doc.heightOfString(c.text, { width: c.w - pad * 2 });
            });
            const rowH = Math.max(22, ...maxLines.map((h) => h + pad * 2));
            ensureSpace(rowH + 4);
            const y = doc.y;
            if (alt) {
                doc.save();
                doc.rect(left, y, right() - left, rowH).fill(BRAND.tableRowAlt);
                doc.restore();
            }
            let x = left;
            cells.forEach((c) => {
                doc.font('Helvetica').fontSize(9).fillColor(BRAND.ink).text(c.text, x + pad, y + pad, {
                    width: c.w - pad * 2,
                    lineGap: 1,
                });
                x += c.w;
            });
            doc.y = y + rowH;
        };

        // — Title block (template-style headline + project strip; page 1 only)
        const titleY = doc.y;
        doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND.ink).text(titleMain, left, titleY, {
            width: right() - left,
            align: 'center',
        });
        const afterTitleY = doc.y + 4;
        doc.moveTo(left, afterTitleY).lineTo(right(), afterTitleY).strokeColor(BRAND.orange).lineWidth(1).stroke();
        doc.x = left;
        doc.y = afterTitleY + 10;
        doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND.ink).text(projectName, left, doc.y, {
            width: right() - left,
            align: 'center',
        });
        doc.moveDown(0.25);
        doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.muted).text(
            `Reporting period: ${fmtDate(report.period_start)} — ${fmtDate(report.period_end)}`,
            { width: right() - left, align: 'center' },
        );
        doc.moveDown(1.15);

        sectionTitle('EXECUTIVE SUMMARY');
        drawKpiRow();
        doc.moveDown(0.6);

        const summary = (report.summary || {}) as {
            document_titles?: string[];
            photo_summary?: { count: number; user: string; folder: string }[];
            rfis?: { title: string; status: string }[];
            snags?: { title: string; status: string }[];
        };

        const docs = summary.document_titles || [];
        sectionTitle('DOCUMENTS UPLOADED');
        if (docs.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text('No documents uploaded in this period.');
            doc.moveDown(1);
        } else {
            const maxRows = 45;
            const shown = docs.slice(0, maxRows);
            tableHeader([{ w: right() - left, text: 'FILE NAME' }]);
            shown.forEach((title, i) => tableRow([{ w: right() - left, text: title }], i % 2 === 1));
            if (docs.length > maxRows) {
                doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(`… and ${docs.length - maxRows} more`, left, doc.y + 4);
                doc.moveDown(1.2);
            }
            doc.moveDown(0.5);
        }

        const photos = summary.photo_summary || [];
        sectionTitle('SITE PHOTO CAPTURE');
        if (photos.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text('No site photos captured in this period.');
            doc.moveDown(1);
        } else {
            const cw = right() - left;
            const w1 = Math.floor(cw * 0.12);
            const w2 = Math.floor(cw * 0.28);
            const w3 = cw - w1 - w2;
            tableHeader([
                { w: w1, text: 'QTY' },
                { w: w2, text: 'CAPTURED BY' },
                { w: w3, text: 'FOLDER' },
            ]);
            photos.forEach((ps, i) => {
                tableRow(
                    [
                        { w: w1, text: String(ps.count) },
                        { w: w2, text: ps.user || '—' },
                        { w: w3, text: ps.folder || '—' },
                    ],
                    i % 2 === 1,
                );
            });
            doc.moveDown(0.5);
        }

        const rfis = summary.rfis || [];
        sectionTitle('REQUESTS FOR INFORMATION (RFIs)');
        if (rfis.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text('No RFIs created or updated in this period.');
            doc.moveDown(1);
        } else {
            const cw = right() - left;
            const w1 = Math.floor(cw * 0.22);
            const w2 = cw - w1;
            tableHeader([
                { w: w1, text: 'STATUS' },
                { w: w2, text: 'TITLE' },
            ]);
            rfis.forEach((rfi, i) => {
                tableRow(
                    [
                        { w: w1, text: (rfi.status || '—').toUpperCase() },
                        { w: w2, text: rfi.title || '—' },
                    ],
                    i % 2 === 1,
                );
            });
            doc.moveDown(0.5);
        }

        const snags = summary.snags || [];
        sectionTitle('SNAG LIST');
        if (snags.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text('No snags created or updated in this period.');
            doc.moveDown(1);
        } else {
            const cw = right() - left;
            const w1 = Math.floor(cw * 0.22);
            const w2 = cw - w1;
            tableHeader([
                { w: w1, text: 'STATUS' },
                { w: w2, text: 'TITLE' },
            ]);
            snags.forEach((snag, i) => {
                tableRow(
                    [
                        { w: w1, text: (snag.status || '—').toUpperCase() },
                        { w: w2, text: snag.title || '—' },
                    ],
                    i % 2 === 1,
                );
            });
            doc.moveDown(0.5);
        }

        const pageCount = doc.bufferedPageRange().count;
        const genAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

        const drawFooterOnPage = (pageIndex: number) => {
            doc.switchToPage(pageIndex);
            const page = doc.page;
            const w = page.width;
            const m = page.margins;
            const maxY = page.maxY();
            const lineY1 = maxY - 20;
            const lineY2 = maxY - 8;
            doc.font('Helvetica').fontSize(7.5);
            doc.moveTo(m.left, maxY - 26).lineTo(w - m.right, maxY - 26).strokeColor(BRAND.line).lineWidth(0.45).stroke();

            const prefix = 'Generated via ';
            const suffix = ' — CONSTRUCTION COMMUNICATION PLATFORM';
            doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted);
            const wp = doc.widthOfString(prefix);
            doc.text(prefix, m.left, lineY1, { lineBreak: false });
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.orange);
            const wBrand = doc.widthOfString('APEXIS');
            doc.text('APEXIS', m.left + wp, lineY1, { lineBreak: false });
            doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted);
            doc.text(suffix, m.left + wp + wBrand, lineY1, { lineBreak: false });

            const line2 = `Page ${pageIndex + 1} of ${pageCount} | ${genAt}`;
            doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted);
            const w2 = doc.widthOfString(line2);
            doc.text(line2, w - m.right - w2, lineY2, { lineBreak: false });
        };

        for (let i = 0; i < pageCount; i++) {
            drawFooterOnPage(i);
        }

        doc.end();
    });
};


import PDFDocument from 'pdfkit';
import db from '../models/index.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, '../assets');
const ASSETS = {
    logo: path.join(ASSETS_DIR, 'app-icon.png'),
    angelica: path.join(ASSETS_DIR, 'fonts/Angelica-C.otf'),
    signature: path.join(ASSETS_DIR, 'Apexis_Signature_for_invoice.png'),
};

const BRAND = {
    orange: '#f97415',
    muted: '#78716c',
    ink: '#1c1917',
    line: '#e7e5e4',
    tableHeader: '#0f172a',
    tableRowAlt: '#f4f4f5',
};

/** --- SHARED PDF LAYOUT HELPERS (Adapted from exportService.ts) --- */

const drawBrandedHeader = (doc: any, taglineStr: string) => {
    const hasLogo = fs.existsSync(ASSETS.logo);
    const hasAngelica = fs.existsSync(ASSETS.angelica);
    const brandFont = hasAngelica ? 'Angelica' : 'Helvetica-Bold';
    const pageW = doc.page.width;

    const logoH = 32;
    const blockTop = 25;

    doc.font(brandFont).fontSize(20);
    const apexW = doc.widthOfString('APEXIS');
    doc.fontSize(12);
    const proW = doc.widthOfString('PRO™');
    const brandTextW = apexW + proW;

    doc.font('Helvetica-Bold').fontSize(5.5);
    const tagW = doc.widthOfString(taglineStr);
    const gap = 10;
    const clusterW = (hasLogo ? logoH + gap : 0) + Math.max(brandTextW, tagW);
    const clusterLeft = (pageW - clusterW) / 2;

    let textLeft = clusterLeft;
    if (hasLogo) {
        try {
            doc.image(ASSETS.logo, clusterLeft, blockTop, { height: logoH });
        } catch (e) { /* ignore */ }
        textLeft = clusterLeft + logoH + gap;
    }

    doc.font(brandFont).fontSize(20).fillColor(BRAND.orange);
    doc.text('APEXIS', textLeft, blockTop + 4, { lineBreak: false });
    doc.fontSize(12).text('PRO™', textLeft + apexW, blockTop + 10, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(BRAND.muted);
    doc.text(taglineStr, textLeft + (brandTextW - tagW) / 2 + 3, blockTop + 28, { lineBreak: false });

    // Header Rule
    const left = doc.page.margins.left;
    const r = pageW - doc.page.margins.right;
    const ruleY = blockTop + logoH + 15;
    doc.moveTo(left, ruleY).lineTo(r, ruleY).strokeColor(BRAND.orange).lineWidth(0.8).stroke();

    doc.y = ruleY + 15;
};

const drawBrandedFooter = (doc: any, pageIndex: number, totalPages: number, invoiceNo: string) => {
    doc.switchToPage(pageIndex);
    const page = doc.page;
    const pageWidth = page.width;
    const pageHeight = page.height;
    const footerH = 30;
    const footerY = pageHeight - footerH;

    // Fill footer background with color
    doc.save().rect(0, footerY, pageWidth, footerH).fill(BRAND.tableRowAlt).restore();

    const brandFont = fs.existsSync(ASSETS.angelica) ? 'Angelica' : 'Helvetica-Bold';
    const genAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const m = page.margins;
    const textY = footerY + 10;

    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted);
    const prefix = 'Generated via ';
    const wp = doc.widthOfString(prefix);
    doc.text(prefix, m.left, textY, { lineBreak: false });

    doc.font(brandFont).fontSize(10).fillColor(BRAND.orange);
    const apexFooterW = doc.widthOfString('APEXIS');
    doc.fontSize(7);
    const proFooterW = doc.widthOfString('PRO™');
    const wb = apexFooterW + proFooterW;
    
    doc.font(brandFont).fontSize(10).text('APEXIS', m.left + wp, textY - 2.5, { lineBreak: false });
    doc.fontSize(7).text('PRO™', m.left + wp + apexFooterW, textY - 0.5, { lineBreak: false });

    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted);
    doc.text(' — CONSTRUCTION COMMUNICATION PLATFORM', m.left + wp + wb, textY, { lineBreak: false });

    const pgText = `Invoice: ${invoiceNo}`;
    const pgW = doc.widthOfString(pgText);
    doc.text(pgText, pageWidth - m.right - pgW, textY, { lineBreak: false });
};

const drawSeparator = (doc: any) => {
    doc.moveDown(1.5);
    const y = doc.y;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
    doc.moveDown(1.5);
};

export const generateInvoice = async (transactionId: number): Promise<Buffer> => {
    const transaction = await db.transactions.findByPk(transactionId);
    if (!transaction) throw new Error("Transaction not found");

    const organization = await db.organizations.findByPk(transaction.organization_id);
    const user = await db.users.findOne({ where: { organization_id: transaction.organization_id, is_primary: true } });

    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 }, bufferPages: true });
    const chunks: any[] = [];

    if (fs.existsSync(ASSETS.angelica)) {
        doc.registerFont('Angelica', ASSETS.angelica);
    }

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // --- 1. Header & Title ---
        drawBrandedHeader(doc, 'RECORD · REPORT · RELEASE .');

        doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND.ink);
        doc.text('TAX INVOICE – SOFTWARE SUBSCRIPTION', 50, doc.y, {
            align: 'center',
            width: doc.page.width - 100
        });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(BRAND.orange).lineWidth(1.2).stroke();
        doc.moveDown(1.5);

        const startY = doc.y;
        const leftColX = 50;
        const rightColX = 350;

        // --- 2. Company Details (Left) ---
        doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.ink).text('APEXISpro™ Systems Private Limited', leftColX);
        doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted);
        doc.text('H.No. 10-5-37, Rose Residency');
        doc.text('Masab Tank, Hyderabad – 500028');
        doc.text('Email: info@apexis.in');
        doc.text('Phone: +91-8125958073');
        doc.moveDown(0.5);

        // --- 3. Invoice Details (Right) ---
        const drawDetailLine = (label: string, value: string, y: number) => {
            doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text(label, rightColX, y);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.ink).text(value, rightColX + 80, y, { width: 120 });
        };

        const formatDate = (date: any) => date ? new Date(date).toLocaleDateString('en-GB') : 'dd/mm/yyyy';
        const formatPeriod = (start: any, end: any) => {
            if (!start || !end) return 'e.g. Apr 2025 – Jun 2025';
            const s = new Date(start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
            const e = new Date(end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
            return `${s} – ${e}`;
        };

        let currY = startY;
        drawDetailLine('Invoice No.', transaction.invoice_number || 'PENDING', currY);
        currY += 18;
        drawDetailLine('Invoice Date', formatDate(transaction.created_at), currY);
        currY += 18;
        drawDetailLine('Billing Period', formatPeriod(organization?.plan_start_date, organization?.plan_end_date), currY);
        currY += 18;
        drawDetailLine('Plan Name', organization?.plan_name || 'Professional', currY);
        currY += 18;
        drawDetailLine('Renewal Cycle', transaction.subscription_cycle || 'Monthly', currY);
        currY += 18;
        const dueDate = organization?.plan_end_date ? new Date(new Date(organization.plan_end_date).getTime() + (4 * 24 * 60 * 60 * 1000)) : null;
        drawDetailLine('Due Date', formatDate(dueDate), currY);

        // doc.y = startY + 120;

        drawSeparator(doc);


        // --- 4. BILL TO Section ---
        doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.orange).text('BILL TO', 50);
        doc.moveDown(0.5);
        const billX = 50;
        const billW = (doc.page.width - 100) / 2;
        const billY = doc.y;

        const drawBillBox = (label: string, value: string, x: number, y: number) => {
            const labelW = 80;
            doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(label.toUpperCase(), x, y);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.ink).text(value || '-', x + labelW, y - 1, { width: billW - labelW });
        };

        drawBillBox('Company Name', organization?.name || '-', billX, billY);
        drawBillBox('Contact Person', user?.name || '-', billX + billW, billY);
        drawBillBox('Email', user?.email || '-', billX, billY + 18);
        drawBillBox('GSTIN', '-', billX + billW, billY + 18);
        drawBillBox('Phone', user?.phone_number || '-', billX, billY + 36);

        // doc.y = billY + 60;


        drawSeparator(doc);

        // --- 5. Subscription Details Table ---
        doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.orange).text('SUBSCRIPTION DETAILS', 50);
        doc.moveDown(0.5);

        const tableX = 50;
        const tableW = doc.page.width - 100;
        const colWidths = [tableW * 0.20, tableW * 0.30, tableW * 0.17, tableW * 0.16, tableW * 0.17];
        const headers = ['Plan Name', 'Billing Period', 'Unit Price (INR)', 'GST 18%', 'Total (INR)'];

        const tableStartY = doc.y;
        const radius = 6;
        const headerH = 25;
        doc.save()
            .roundedRect(tableX, tableStartY, tableW, headerH, radius)
            .fill(BRAND.tableHeader)
            .rect(tableX, tableStartY + 10, tableW, 15) // Squaring off the bottom corners
            .fill(BRAND.tableHeader)
            .restore();

        let headX = tableX;
        headers.forEach((h, i) => {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(h, headX + 5, tableStartY + 8, { width: colWidths[i] - 10, align: i > 1 ? 'right' : 'left' });
            headX += colWidths[i];
        });

        const subtotal = Number(organization.plan_price);
        const cgst = subtotal * 0.09;
        const sgst = subtotal * 0.09;
        const grandTotal = subtotal + cgst + sgst;

        const rowY = tableStartY + headerH;
        const rowRadius = 6;
        doc.save()
            .roundedRect(tableX, rowY, tableW, 25, rowRadius)
            .fill(BRAND.tableRowAlt)
            .rect(tableX, rowY, tableW, 15) // Squaring off the top corners of the row
            .fill(BRAND.tableRowAlt)
            .restore();

        const rowData = [
            organization?.plan_name || '-',
            formatPeriod(organization?.plan_start_date, organization?.plan_end_date),
            subtotal.toFixed(2),
            (cgst + sgst).toFixed(2),
            grandTotal.toFixed(2)
        ];

        let cellX = tableX;
        rowData.forEach((val, i) => {
            doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.ink).text(String(val), cellX + 5, rowY + 8, { width: colWidths[i] - 10, align: i > 1 ? 'right' : 'left' });
            cellX += colWidths[i];
        });

        // --- 6. Totals Summary ---
        doc.y = rowY + 40;
        const summaryX = doc.page.width - 240;
        const drawTotalLine = (label: string, price: number, isGrand: boolean = false) => {
            const y = doc.y;
            doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(isGrand ? 11 : 9).fillColor(isGrand ? BRAND.ink : BRAND.muted).text(label, summaryX, y);
            doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(isGrand ? 11 : 9).fillColor(isGrand ? BRAND.orange : BRAND.ink).text(`INR ${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 100, y, { align: 'right', width: 90 });
            doc.moveDown(isGrand ? 0.8 : 0.5);
        };

        drawTotalLine('Subtotal', subtotal);
        drawTotalLine('CGST @ 9%', cgst);
        drawTotalLine('SGST @ 9%', sgst);
        doc.moveTo(summaryX, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
        doc.moveDown(0.5);
        drawTotalLine('Grand Total', grandTotal, true);



        drawSeparator(doc);

        // --- 7. Payment Information ---
        // doc.y += 20;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.orange).text('PAYMENT INFORMATION', 50);
        doc.moveDown(0.5);
        const payY = doc.y;
        const payColW = (doc.page.width - 100) / 2;

        const drawPayLine = (label: string, value: string, x: number, y: number) => {
            doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(label, x, y);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.ink).text(value, x + 80, y, { width: payColW - 85 });
        };

        drawPayLine('Bank Name', 'HDFC Bank Ltd', 50, payY);
        drawPayLine('Account Name', 'APEXISpro™ Systems Private Limited', 50 + payColW, payY);
        drawPayLine('Account Number', '50200118128748', 50, payY + 18);
        drawPayLine('IFSC Code', 'HDFC0009817', 50 + payColW, payY + 18);
        drawPayLine('Branch', 'Bankhouse Banjarahills', 50, payY + 36);


        drawSeparator(doc);

        // --- 8. Terms & Footer ---
        // doc.y = payY + 70;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.orange).text('TERMS & CONDITIONS', 50);
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text('Subscription access to Apexis platform is activated upon receipt of payment. Renewal invoices are generated automatically before expiry of billing cycle.', 50, doc.y, { width: doc.page.width - 100 });


        drawSeparator(doc);


        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text('For APEXISpro™ Systems Private Limited', 50);

        // --- Signature Image ---
        if (fs.existsSync(ASSETS.signature)) {
            doc.image(ASSETS.signature, 50, doc.y + 5, { height: 30 });
            doc.y += 35;
        } else {
            doc.moveDown(2.5);
        }

        doc.moveTo(50, doc.y).lineTo(200, doc.y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.ink).text('Authorized Signatory', 50, doc.y + 5);

        // Finalize Footers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            drawBrandedFooter(doc, i, range.count, transaction.invoice_number || 'PENDING');
        }

        doc.end();
    });
};
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

interface Buffer extends Uint8Array {}
declare const Buffer: any;

/**
 * Adds a "DO NOT FOLLOW" watermark to every page of a PDF document.
 */
export const addDoNotFollowWatermarkToPDF = async (pdfBuffer: Uint8Array): Promise<Buffer> => {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const text = 'DO NOT FOLLOW';
        const opacity = 0.25; // Slightly darker for better visibility

        for (const page of pages) {
            const { width, height } = page.getSize();
            
            // Calculate a dynamic font size so the watermark scales beautifully with the page size.
            // We target the watermark text width to cover about 60% of the page's diagonal.
            const diagonal = Math.sqrt(width * width + height * height);
            const targetTextWidth = diagonal * 0.6;
            const widthAtSize1 = font.widthOfTextAtSize(text, 1);
            
            // Dynamic text size capped between a min of 24 and max of 150
            const textSize = Math.min(Math.max(targetTextWidth / widthAtSize1, 24), 150);

            // Calculate center and text metrics dynamically
            const textWidth = font.widthOfTextAtSize(text, textSize);
            const textHeight = font.heightAtSize(textSize);

            const centerX = width / 2;
            const centerY = height / 2;
            const rotation = degrees(45);

            // Draw large diagonal text
            page.drawText(text, {
                x: centerX - (textWidth / 2) * Math.cos(Math.PI / 4) + (textHeight / 2) * Math.sin(Math.PI / 4),
                y: centerY - (textWidth / 2) * Math.sin(Math.PI / 4) - (textHeight / 2) * Math.cos(Math.PI / 4),
                size: textSize,
                font: font,
                color: rgb(0.9, 0.1, 0.1), 
                opacity: opacity,
                rotate: rotation,
            });
            
            // Add parallel dashed lines scaled to the text size
            const lineOffset = textHeight + (textSize / 6);
            const lineLength = width * 1.5; // Ensure it covers the diagonal
            const thickness = Math.min(Math.max(textSize / 40, 1.5), 4);
            const dashPattern = [textSize / 6, textSize / 12];

            // Top dashed line
            page.drawLine({
                start: { 
                    x: centerX - (lineLength / 2) * Math.cos(Math.PI / 4) + lineOffset * Math.sin(Math.PI / 4), 
                    y: centerY - (lineLength / 2) * Math.sin(Math.PI / 4) - lineOffset * Math.cos(Math.PI / 4)
                },
                end: { 
                    x: centerX + (lineLength / 2) * Math.cos(Math.PI / 4) + lineOffset * Math.sin(Math.PI / 4), 
                    y: centerY + (lineLength / 2) * Math.sin(Math.PI / 4) - lineOffset * Math.cos(Math.PI / 4)
                },
                thickness: thickness,
                color: rgb(0.9, 0.1, 0.1),
                opacity: opacity,
                dashArray: dashPattern,
            });

            // Bottom dashed line
            page.drawLine({
                start: { 
                    x: centerX - (lineLength / 2) * Math.cos(Math.PI / 4) - lineOffset * Math.sin(Math.PI / 4), 
                    y: centerY - (lineLength / 2) * Math.sin(Math.PI / 4) + lineOffset * Math.cos(Math.PI / 4)
                },
                end: { 
                    x: centerX + (lineLength / 2) * Math.cos(Math.PI / 4) - lineOffset * Math.sin(Math.PI / 4), 
                    y: centerY + (lineLength / 2) * Math.sin(Math.PI / 4) + lineOffset * Math.cos(Math.PI / 4)
                },
                thickness: thickness,
                color: rgb(0.9, 0.1, 0.1),
                opacity: opacity,
                dashArray: dashPattern,
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return Buffer.from(modifiedPdfBytes);
    } catch (error) {
        console.error("PDF Watermarking failed:", error);
        return Buffer.from(pdfBuffer);
    }
};

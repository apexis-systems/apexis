import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Adds a "DO NOT FOLLOW" watermark to every page of a PDF document.
 */
export const addDoNotFollowWatermarkToPDF = async (pdfBuffer: Uint8Array): Promise<Buffer> => {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const text = 'DO NOT FOLLOW';
        const textSize = 120; // Much larger
        const opacity = 0.25; // Slightly darker for better visibility

        for (const page of pages) {
            const { width, height } = page.getSize();
            
            // Calculate center
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
            
            // Add parallel dashed lines
            const lineOffset = textHeight + 20;
            const lineLength = width * 1.5; // Ensure it covers the diagonal

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
                thickness: 3,
                color: rgb(0.9, 0.1, 0.1),
                opacity: opacity,
                dashArray: [20, 10],
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
                thickness: 3,
                color: rgb(0.9, 0.1, 0.1),
                opacity: opacity,
                dashArray: [20, 10],
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return Buffer.from(modifiedPdfBytes);
    } catch (error) {
        console.error("PDF Watermarking failed:", error);
        return Buffer.from(pdfBuffer);
    }
};

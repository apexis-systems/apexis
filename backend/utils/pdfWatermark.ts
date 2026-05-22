import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

interface Buffer extends Uint8Array {}
declare const Buffer: any;

/**
 * Adds a "DO NOT FOLLOW" watermark to every page of a PDF document.
 */
export const addWatermarksToPDF = async (pdfBuffer: Uint8Array, options: { doNotFollow?: boolean; onlyForReference?: boolean }): Promise<Buffer> => {
    try {
        if (!options.doNotFollow && !options.onlyForReference) {
            return Buffer.from(pdfBuffer);
        }

        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const opacity = 0.25; // Slightly darker for better visibility

        const watermarks = [];
        if (options.doNotFollow) watermarks.push('DO NOT FOLLOW');
        if (options.onlyForReference) watermarks.push('ONLY FOR REFERENCE');

        for (const page of pages) {
            const { width, height } = page.getSize();
            
            // Calculate a dynamic font size so the watermark scales beautifully with the page size.
            // We target the watermark text width to cover about 60% of the page's diagonal.
            const diagonal = Math.sqrt(width * width + height * height);
            const targetTextWidth = diagonal * 0.6;
            
            // Find max length watermark to determine size
            const longestText = watermarks.reduce((a, b) => a.length > b.length ? a : b, '');
            const widthAtSize1 = font.widthOfTextAtSize(longestText, 1);
            
            // Dynamic text size capped between a min of 24 and max of 150
            const textSize = Math.min(Math.max(targetTextWidth / widthAtSize1, 24), 150);
            const textHeight = font.heightAtSize(textSize);

            const centerX = width / 2;
            const centerY = height / 2;
            const rotation = degrees(45);
            
            const lineLength = width * 1.5; // Ensure it covers the diagonal
            const thickness = Math.min(Math.max(textSize / 40, 1.5), 4);
            const dashPattern = [textSize / 6, textSize / 12];

            // If we have multiple watermarks, we offset them perpendicular to the 45 degree angle
            // Math.PI / 4 is the rotation angle
            // Perpendicular direction (up-left) is Math.PI / 4 + Math.PI / 2 = 3 * Math.PI / 4
            // So x offset goes by cos(3pi/4), y offset by sin(3pi/4)
            // Or simpler: shifting along the perpendicular means shifting y before rotation.
            
            // Let's calculate offsets
            // Total height of a block including dashed lines: textHeight + 2 * (textSize / 6)
            const blockHeight = textHeight + (textSize / 3);
            const spacing = blockHeight * 2.2; // Increased spacing between watermarks

            watermarks.forEach((text, index) => {
                let offsetPerp = 0;
                if (watermarks.length === 2) {
                    // For two watermarks, offset them symmetrically
                    offsetPerp = index === 0 ? spacing / 2 : -spacing / 2;
                }

                // Perpendicular direction components (perpendicular to +45 deg is 135 deg)
                // dx = offsetPerp * cos(135 deg) = offsetPerp * (-cos(45)) = -offsetPerp * cos(45)
                // dy = offsetPerp * sin(135 deg) = offsetPerp * sin(45)
                const dxPerp = -offsetPerp * Math.cos(Math.PI / 4);
                const dyPerp = offsetPerp * Math.sin(Math.PI / 4);

                const textWidth = font.widthOfTextAtSize(text, textSize);
                
                // Draw large diagonal text
                page.drawText(text, {
                    x: centerX + dxPerp - (textWidth / 2) * Math.cos(Math.PI / 4) + (textHeight / 2) * Math.sin(Math.PI / 4),
                    y: centerY + dyPerp - (textWidth / 2) * Math.sin(Math.PI / 4) - (textHeight / 2) * Math.cos(Math.PI / 4),
                    size: textSize,
                    font: font,
                    color: text === 'DO NOT FOLLOW' ? rgb(0.9, 0.1, 0.1) : rgb(0.1, 0.1, 0.9), // Blue for ONLY FOR REFERENCE
                    opacity: opacity,
                    rotate: rotation,
                });
                
                // Add parallel dashed lines scaled to the text size
                const lineOffset = textHeight + (textSize / 6);

                // Top dashed line
                page.drawLine({
                    start: { 
                        x: centerX + dxPerp - (lineLength / 2) * Math.cos(Math.PI / 4) + lineOffset * Math.sin(Math.PI / 4), 
                        y: centerY + dyPerp - (lineLength / 2) * Math.sin(Math.PI / 4) - lineOffset * Math.cos(Math.PI / 4)
                    },
                    end: { 
                        x: centerX + dxPerp + (lineLength / 2) * Math.cos(Math.PI / 4) + lineOffset * Math.sin(Math.PI / 4), 
                        y: centerY + dyPerp + (lineLength / 2) * Math.sin(Math.PI / 4) - lineOffset * Math.cos(Math.PI / 4)
                    },
                    thickness: thickness,
                    color: text === 'DO NOT FOLLOW' ? rgb(0.9, 0.1, 0.1) : rgb(0.1, 0.1, 0.9),
                    opacity: opacity,
                    dashArray: dashPattern,
                });

                // Bottom dashed line
                page.drawLine({
                    start: { 
                        x: centerX + dxPerp - (lineLength / 2) * Math.cos(Math.PI / 4) - lineOffset * Math.sin(Math.PI / 4), 
                        y: centerY + dyPerp - (lineLength / 2) * Math.sin(Math.PI / 4) + lineOffset * Math.cos(Math.PI / 4)
                    },
                    end: { 
                        x: centerX + dxPerp + (lineLength / 2) * Math.cos(Math.PI / 4) - lineOffset * Math.sin(Math.PI / 4), 
                        y: centerY + dyPerp + (lineLength / 2) * Math.sin(Math.PI / 4) + lineOffset * Math.cos(Math.PI / 4)
                    },
                    thickness: thickness,
                    color: text === 'DO NOT FOLLOW' ? rgb(0.9, 0.1, 0.1) : rgb(0.1, 0.1, 0.9),
                    opacity: opacity,
                    dashArray: dashPattern,
                });
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return Buffer.from(modifiedPdfBytes);
    } catch (error) {
        console.error("PDF Watermarking failed:", error);
        return Buffer.from(pdfBuffer);
    }
};

export const addDoNotFollowWatermarkToPDF = async (pdfBuffer: Uint8Array): Promise<Buffer> => {
    return addWatermarksToPDF(pdfBuffer, { doNotFollow: true });
};


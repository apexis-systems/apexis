import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import opentype from 'opentype.js';

let cachedFont: opentype.Font | null = null;

const getFont = async (fontPath: string): Promise<opentype.Font> => {
    if (cachedFont) return cachedFont;
    return new Promise((resolve, reject) => {
        opentype.load(fontPath, (err, font) => {
            if (err || !font) reject(err || new Error("Failed to load font"));
            else {
                cachedFont = font;
                resolve(font);
            }
        });
    });
};

/**
 * Adds a professional watermark band at the bottom of an image buffer.
 * Contains: DATE & TIME (left) | LOGO + APEXIS (right)
 */
export const addWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const originalWidth = metadata.width || 1280;
        const finalWidth = Math.min(originalWidth, 1280);

        // Dynamically adjust dimensions
        const fontSize = Math.max(12, Math.min(22, Math.round(finalWidth * 0.02)));
        const bandHeight = Math.round(fontSize * 4);
        const svgWidth = finalWidth;
        const svgHeight = bandHeight;

        // Date & Time formatting
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

        // Assets
        const logoPath = path.join(process.cwd(), 'assets', 'app-icon.png');
        const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Angelica-C.otf');
        const logoSize = Math.round(bandHeight * 0.7);

        // 1. Get Brand Text Path using opentype.js (ABSOLUTE font control)
        const brandText = "APEXIS";
        const brandFontSize = Math.round(fontSize * 1.8);
        const font = await getFont(fontPath);
        
        // Measure text width to align right correctly
        // opentype.js units: font.getAdvanceWidth(text, fontSize, options)
        const brandTextWidth = font.getAdvanceWidth(brandText, brandFontSize);
        
        // Get the SVG path data
        // .getPath(text, x, y, fontSize, options)
        const textPathObject = font.getPath(brandText, 0, 0, brandFontSize);
        const brandPathData = textPathObject.toPathData(2); // 2 decimal places

        // Branding layout: [LOGO] [GAP] [TEXT]
        const gap = 3;
        const brandingTotalWidth = logoSize + gap + brandTextWidth;
        const logoX = svgWidth - 20 - brandingTotalWidth;
        const textX = logoX + logoSize + gap;
        const textY = (svgHeight / 2) + (brandFontSize / 3); // Vertical center adjustment

        // 2. Create Logo Base64
        let logoBase64 = '';
        if (fs.existsSync(logoPath)) {
            logoBase64 = fs.readFileSync(logoPath).toString('base64');
        }

        // 3. Final Combined SVG
        const svgOverlay = `
            <svg width="${svgWidth}" height="${svgHeight}">
                <!-- Date/Time (Left) -->
                <text x="20" y="50%" dominant-baseline="middle" text-anchor="start" 
                      fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${fontSize}px" letter-spacing="0.5px">
                    ${dateStr}   |   ${timeStr}
                </text>
                
                <!-- Logo (Right) -->
                ${logoBase64 ? `
                <image 
                    href="data:image/png;base64,${logoBase64}" 
                    x="${logoX}" 
                    y="${(svgHeight - logoSize) / 2}" 
                    height="${logoSize}" 
                    width="${logoSize}" 
                />` : ''}
                
                <!-- Brand Text (Right) as SVG Path for perfect font control -->
                <path d="${brandPathData}" fill="#f97415" transform="translate(${textX}, ${textY})" />
            </svg>
        `;

        return await image
            .resize({ width: 1280, withoutEnlargement: true })
            .extend({
                bottom: bandHeight,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .composite([{
                input: Buffer.from(svgOverlay),
                gravity: 'south'
            }])
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (err) {
        console.error("Watermarking failed:", err);
        return imageBuffer;
    }
};

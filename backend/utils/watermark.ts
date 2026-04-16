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
 * New Layout: Branding (Left) | DATE & TIME + PROJECT NAME (Right)
 */
export const addWatermark = async (imageBuffer: Buffer, projectName: string = ''): Promise<Buffer> => {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const originalWidth = metadata.width || 1920;
        const finalWidth = Math.min(originalWidth, 1920);

        // Dynamically adjust dimensions
        const fontSize = Math.max(9, Math.round(finalWidth * 0.02) - 3); // Reduced size by 3 points for a smaller watermark
        const bandHeight = Math.round(fontSize * 4); // Slightly slimmer band for a cleaner footer
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
        const brandTextApex = "APEXIS";
        const brandTextPro = "PRO™";
        const brandFontSizeApex = Math.round(fontSize * 1.8);
        const brandFontSizePro = Math.round(fontSize * 1.0);
        const font = await getFont(fontPath);

        // Measure widths
        const apexWidth = font.getAdvanceWidth(brandTextApex, brandFontSizeApex);
        
        // Get paths
        const apexPathObj = font.getPath(brandTextApex, 0, 0, brandFontSizeApex);
        const proPathObj = font.getPath(brandTextPro, 0, 0, brandFontSizePro);
        
        const apexPathData = apexPathObj.toPathData(2);
        const proPathData = proPathObj.toPathData(2);

        // Branding layout (Left side)
        const gap = 3;
        const logoX = 20;
        const brandTextX = logoX + logoSize + gap;
        const brandTextY = (svgHeight / 2) + (brandFontSizeApex / 3);
        const proX = brandTextX + apexWidth + 4; // small gap between APEXIS and PRO
        const proY = brandTextY;

        // 2. Create Logo Base64
        let logoBase64 = '';
        if (fs.existsSync(logoPath)) {
            logoBase64 = fs.readFileSync(logoPath).toString('base64');
        }

        // 3. Right side layout (Project and Time)
        const infoX = svgWidth - 20;

        // 4. Final Combined SVG
        const svgOverlay = `
            <svg width="${svgWidth}" height="${svgHeight}">
                <!-- Left Branding: Logo + Name -->
                ${logoBase64 ? `
                <image 
                    href="data:image/png;base64,${logoBase64}" 
                    x="${logoX}" 
                    y="${(svgHeight - logoSize) / 2}" 
                    height="${logoSize}" 
                    width="${logoSize}" 
                />` : ''}
                <path d="${apexPathData}" fill="#f97415" transform="translate(${brandTextX}, ${brandTextY})" />
                <path d="${proPathData}" fill="#f97415" transform="translate(${proX}, ${proY})" />

                <!-- Right Info: Date/Time (Top) + Project Name (Bottom) -->
                <text x="${infoX}" y="40%" dominant-baseline="middle" text-anchor="end" 
                      fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${fontSize}px" letter-spacing="0.5px">
                    ${dateStr}  |  ${timeStr}
                </text>
                <text x="${infoX}" y="70%" dominant-baseline="middle" text-anchor="end" 
                      fill="#666666" font-family="sans-serif" font-weight="600" font-size="${Math.round(fontSize * 0.9)}px">
                    ${projectName.toUpperCase()}
                </text>
            </svg>
        `;

        return await image
            .resize({ width: 1920, withoutEnlargement: true })
            .extend({
                bottom: bandHeight,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .composite([{
                input: Buffer.from(svgOverlay),
                gravity: 'south'
            }])
            .jpeg({ quality: 85 })
            .toBuffer();
    } catch (err) {
        console.error("Watermarking failed:", err);
        return imageBuffer;
    }
};

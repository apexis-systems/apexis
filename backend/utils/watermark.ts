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
export const addWatermark = async (imageBuffer: Buffer, projectName: string = '', userName: string = ''): Promise<Buffer> => {
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
        const logoSize = Math.round(bandHeight * 0.5); // Reduced from 0.7 to 0.5 per user request

        // 1. Get Brand Text Path using opentype.js (ABSOLUTE font control)
        const brandTextApex = "APEXIS";
        const brandTextPro = "PRO™";
        const brandFontSizeApex = fontSize; // Match the date/time fontSize exactly
        const brandFontSizePro = Math.round(fontSize * 0.65); // Smaller secondary branding
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

        // 3. Info Layout positions
        const infoXRight = svgWidth - 20;
        const infoXCenter = svgWidth / 2;

        // Project Name Wrapping (Center)
        const maxProjectChars = 20; // threshold for splitting into two lines
        const projectUpperCase = projectName.toUpperCase();
        let projectLines = [projectUpperCase];
        
        if (projectUpperCase.length > maxProjectChars) {
            const words = projectUpperCase.split(' ');
            let line1 = '';
            let lineIdx = 0;
            
            while (lineIdx < words.length && (line1 + words[lineIdx]).length <= maxProjectChars) {
                line1 += (line1 ? ' ' : '') + words[lineIdx];
                lineIdx++;
            }
            
            if (line1) {
                projectLines = [line1, words.slice(lineIdx).join(' ')];
            }
            // If even a single word is too long, or we couldn't split nicely, just take a chunk
            if (projectLines.length === 1 || projectLines[1].length === 0) {
                 projectLines = [projectUpperCase.slice(0, maxProjectChars), projectUpperCase.slice(maxProjectChars)];
            }
        }

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

                <!-- Center: Project Name (1 or 2 lines) -->
                ${projectLines.length > 1 ? `
                    <text x="${infoXCenter}" y="40%" dominant-baseline="middle" text-anchor="middle" 
                          fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${Math.round(fontSize * 1.0)}px">
                        ${projectLines[0]}
                    </text>
                    <text x="${infoXCenter}" y="75%" dominant-baseline="middle" text-anchor="middle" 
                          fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${Math.round(fontSize * 1.0)}px">
                        ${projectLines[1]}
                    </text>
                ` : `
                    <text x="${infoXCenter}" y="55%" dominant-baseline="middle" text-anchor="middle" 
                          fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${Math.round(fontSize * 1.1)}px">
                        ${projectLines[0]}
                    </text>
                `}

                <!-- Right Info: Date/Time (Top) + Uploaded By (Bottom) -->
                <text x="${infoXRight}" y="40%" dominant-baseline="middle" text-anchor="end" 
                      fill="#1a1a1a" font-family="sans-serif" font-weight="800" font-size="${fontSize}px" letter-spacing="0.5px">
                    ${dateStr} | ${timeStr}
                </text>
                <text x="${infoXRight}" y="75%" dominant-baseline="middle" text-anchor="end" 
                      fill="#666666" font-family="sans-serif" font-weight="600" font-size="${Math.round(fontSize * 0.85)}px">
                    UPLOADED BY : ${userName.toUpperCase()}
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

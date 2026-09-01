import zlib from "zlib";

/**
 * Standard PKZIP builder in pure Node.js (zero external dependencies).
 * Fully compatible with Windows Explorer, macOS Archive Utility, Linux unzip, and 7-Zip.
 */

// CRC32 table calculation fallback
const makeCRCTable = () => {
    let c: number;
    const crcTable: number[] = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[n] = c >>> 0;
    }
    return crcTable;
};

const CRC_TABLE = makeCRCTable();

export const calculateCRC32 = (buf: Buffer): number => {
    if (typeof (zlib as any).crc32 === "function") {
        return (zlib as any).crc32(buf) >>> 0;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
};

export interface ZipEntry {
    name: string; // Relative path inside zip, e.g. "photos/site1.jpg"
    data: Buffer;
    mtime?: Date;
}

export class SimpleZip {
    private entries: ZipEntry[] = [];

    public addFile(name: string, data: Buffer | string, mtime?: Date) {
        const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
        const normalizedName = name.replace(/\\/g, "/").replace(/^\/+/, "");
        this.entries.push({
            name: normalizedName,
            data: buf,
            mtime: mtime || new Date(),
        });
    }

    public build(): Buffer {
        const localHeaders: Buffer[] = [];
        const centralDirs: Buffer[] = [];
        let offset = 0;

        for (const entry of this.entries) {
            const fileNameBuffer = Buffer.from(entry.name, "utf8");
            const crc = calculateCRC32(entry.data);
            const uncompressedSize = entry.data.length;

            // Compress data using DeflateRaw (standard zip compression)
            let compressedData: Buffer;
            let compressionMethod = 8; // DEFLATE
            try {
                compressedData = zlib.deflateRawSync(entry.data, { level: 6 });
            } catch (err) {
                // If compression fails, store as uncompressed
                compressedData = entry.data;
                compressionMethod = 0;
            }

            const compressedSize = compressedData.length;

            // Convert date to MS-DOS date/time format
            const d = entry.mtime || new Date();
            const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xFFFF;
            const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

            // --- 1. Local File Header ---
            // 0x04034b50 (4 bytes), min version 20 (2 bytes), general flag 0x0800 for UTF-8 (2 bytes),
            // compression method (2 bytes), dosTime (2 bytes), dosDate (2 bytes),
            // crc32 (4 bytes), compSize (4 bytes), uncompSize (4 bytes),
            // fileNameLen (2 bytes), extraLen (2 bytes) = 30 bytes total
            const localHeader = Buffer.alloc(30);
            localHeader.writeUInt32LE(0x04034b50, 0);
            localHeader.writeUInt16LE(20, 4); // version needed
            localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
            localHeader.writeUInt16LE(compressionMethod, 8);
            localHeader.writeUInt16LE(dosTime, 10);
            localHeader.writeUInt16LE(dosDate, 12);
            localHeader.writeUInt32LE(crc, 14);
            localHeader.writeUInt32LE(compressedSize, 18);
            localHeader.writeUInt32LE(uncompressedSize, 22);
            localHeader.writeUInt16LE(fileNameBuffer.length, 26);
            localHeader.writeUInt16LE(0, 28); // extra field length

            const localChunk = Buffer.concat([localHeader, fileNameBuffer, compressedData]);
            localHeaders.push(localChunk);

            // --- 2. Central Directory Header ---
            // 0x02014b50 (4 bytes), version made by (2 bytes), version needed (2 bytes), flag (2 bytes),
            // method (2 bytes), dosTime (2 bytes), dosDate (2 bytes), crc32 (4 bytes),
            // compSize (4 bytes), uncompSize (4 bytes), fileNameLen (2 bytes),
            // extraLen (2 bytes), commentLen (2 bytes), diskStart (2 bytes),
            // intAttr (2 bytes), extAttr (4 bytes), localHeaderOffset (4 bytes) = 46 bytes total
            const centralHeader = Buffer.alloc(46);
            centralHeader.writeUInt32LE(0x02014b50, 0);
            centralHeader.writeUInt16LE(20, 4); // version made by
            centralHeader.writeUInt16LE(20, 6); // version needed
            centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
            centralHeader.writeUInt16LE(compressionMethod, 10);
            centralHeader.writeUInt16LE(dosTime, 12);
            centralHeader.writeUInt16LE(dosDate, 14);
            centralHeader.writeUInt32LE(crc, 16);
            centralHeader.writeUInt32LE(compressedSize, 20);
            centralHeader.writeUInt32LE(uncompressedSize, 24);
            centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
            centralHeader.writeUInt16LE(0, 30); // extra len
            centralHeader.writeUInt16LE(0, 32); // comment len
            centralHeader.writeUInt16LE(0, 34); // disk number start
            centralHeader.writeUInt16LE(0, 36); // internal attrs
            centralHeader.writeUInt32LE(0x81B60000, 38); // external attrs (standard file permissions)
            centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

            const centralChunk = Buffer.concat([centralHeader, fileNameBuffer]);
            centralDirs.push(centralChunk);

            offset += localChunk.length;
        }

        const localData = Buffer.concat(localHeaders);
        const centralData = Buffer.concat(centralDirs);

        // --- 3. End of Central Directory Record (EOCD) ---
        // 0x06054b50 (4 bytes), disk number (2 bytes), start disk (2 bytes),
        // total entries on disk (2 bytes), total entries overall (2 bytes),
        // central directory size (4 bytes), central directory offset (4 bytes),
        // commentLen (2 bytes) = 22 bytes total
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4); // disk number
        eocd.writeUInt16LE(0, 6); // disk with central dir
        eocd.writeUInt16LE(this.entries.length, 8); // entries on this disk
        eocd.writeUInt16LE(this.entries.length, 10); // total entries
        eocd.writeUInt32LE(centralData.length, 12); // size of central dir
        eocd.writeUInt32LE(localData.length, 16); // offset of central dir
        eocd.writeUInt16LE(0, 20); // zip comment length

        return Buffer.concat([localData, centralData, eocd]);
    }
}

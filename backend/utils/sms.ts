/**
 * Fast2SMS Quick SMS Route (No DLT Registration Required)
 * Route: 'q'
 * Pricing: ₹5.00 per SMS
 * Delivery: DND & Non-DND
 */

/**
 * Normalizes phone numbers for database consistency.
 * - If exactly 10 digits are provided (Indian format), prepends +91.
 * - If already in E.164 format (e.g. +971XXXXXXXXX), returns as-is.
 * - Otherwise returns trimmed value.
 */
export const normalizePhone = (phone: string): string => {
    const cleaned = phone.trim();
    if (/^\d{10}$/.test(cleaned)) {
        return `+91${cleaned}`;
    }
    return cleaned;
};

/**
 * Validates any phone number in E.164 format (e.g. +91XXXXXXXXXX, +971XXXXXXXXX).
 * Accepts: "+<countrycode><subscriber>" with 7–15 total digits after the +.
 * Also accepts plain 10-digit Indian numbers for backwards compatibility.
 */
export const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.trim();
    // Plain 10-digit Indian number
    if (/^\d{10}$/.test(cleaned)) return true;
    // E.164 format: + followed by 7 to 15 digits
    if (/^\+\d{7,15}$/.test(cleaned)) return true;
    return false;
};

/**
 * Returns true only if the phone number belongs to India (+91).
 * Phone OTP via Fast2SMS is only supported for Indian numbers.
 */
export const isIndianPhone = (phone: string): boolean => {
    const cleaned = phone.trim();
    return cleaned.startsWith('+91') || /^\d{10}$/.test(cleaned);
};


export const sendSMS = async (phone: string, message: string) => {
    try {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) {
            console.error("FAST2SMS_API_KEY is missing in environment variables.");
            return;
        }

        // Normalize for internal use
        const normalizedPhone = normalizePhone(phone);
        
        // Fast2SMS expects 10 digits only
        // Fast2SMS expects 10 digits only for route "q"
        const cleanPhone = normalizedPhone.replace(/\D/g, "").slice(-10);

        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
            method: "POST",
            headers: {
                authorization: apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                route: "q",
                message: message,
                numbers: cleanPhone,
            }),
        });

        const data: any = await response.json();

        if (data.return) {
            console.log(`SMS sent successfully to ${phone}: ${data.message}`);
            return data;
        } else {
            console.error(`Fast2SMS Error for ${phone}:`, data.message);
            throw new Error(data.message);
        }
    } catch (error: any) {
        console.error("Error sending SMS via Fast2SMS:", error.message);
        throw error;
    }
};

export const sendOTP = async (phone: string, otp: string) => {
    const message = `Your APEXISpro™ verification code is: ${otp}. Valid for 5 minutes.`;
    return sendSMS(phone, message);
};

/**
 * Fast2SMS Quick SMS Route (No DLT Registration Required)
 * Route: 'q'
 * Pricing: ₹5.00 per SMS
 * Delivery: DND & Non-DND
 */

/**
 * Normalizes phone numbers to +91XXXXXXXXXX format for database consistency.
 * If 10 digits are provided, prepends +91.
 */
export const normalizePhone = (phone: string): string => {
    const cleaned = phone.trim();
    if (/^\d{10}$/.test(cleaned)) {
        return `+91${cleaned}`;
    }
    return cleaned;
};

/**
 * Validates if the phone number is a valid 10-digit Indian number.
 * Accepts "9876543210" or "+919876543210".
 */
export const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.trim().replace("+91", "");
    return /^\d{10}$/.test(cleaned);
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
    const message = `Your Apexis verification code is: ${otp}. Valid for 5 minutes.`;
    return sendSMS(phone, message);
};

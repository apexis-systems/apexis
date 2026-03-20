/**
 * Fast2SMS Quick SMS Route (No DLT Registration Required)
 * Route: 'q'
 * Pricing: ₹5.00 per SMS
 * Delivery: DND & Non-DND
 */
export const sendSMS = async (phone: string, message: string) => {
    try {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) {
            console.error("FAST2SMS_API_KEY is missing in environment variables.");
            return;
        }

        // Fast2SMS expects numbers as a comma-separated string
        // If phone starts with +91, remove it as Fast2SMS typically expects 10 digits
        const cleanPhone = phone.replace("+91", "").trim();

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

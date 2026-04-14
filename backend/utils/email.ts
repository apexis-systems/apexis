import nodemailer from "nodemailer";

// Create a transporter using standard SMTP configurations or defaulting to Gmail
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_PORT === "465",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

type EmailAttachment = {
    filename?: string;
    path?: string;
    cid?: string;
};

type SendEmailOptions = boolean | {
    isHtml?: boolean;
    text?: string;
    attachments?: EmailAttachment[];
};

export const sendEmail = async (to: string, subject: string, content: string, options: SendEmailOptions = false) => {
    try {
        const normalizedOptions = typeof options === "boolean" ? { isHtml: options } : options;
        const isHtml = Boolean(normalizedOptions.isHtml);
        const info = await transporter.sendMail({
            from: `"APEXISpro" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            [isHtml ? "html" : "text"]: content,
            ...(isHtml && normalizedOptions.text ? { text: normalizedOptions.text } : {}),
            ...(normalizedOptions.attachments?.length ? { attachments: normalizedOptions.attachments } : {}),
        });
        console.log("Email sent: " + info.response);
    } catch (error) {
        console.error("Error sending email: ", error);
    }
};

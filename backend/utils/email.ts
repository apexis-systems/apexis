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

export const sendEmail = async (to: string, subject: string, content: string, isHtml = false) => {
    try {
        const info = await transporter.sendMail({
            from: `"Apexis" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            [isHtml ? "html" : "text"]: content,
        });
        console.log("Email sent: " + info.response);
    } catch (error) {
        console.error("Error sending email: ", error);
    }
};

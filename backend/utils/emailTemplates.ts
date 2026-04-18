import { fileURLToPath } from "node:url";

const appLogoPath = fileURLToPath(new URL("../assets/app-icon.png", import.meta.url));

const BRAND_NAME = 'APEXIS';
const BRAND_SUFFIX = 'PRO™';
const SLOGAN = 'Record.Report.Release.';

export const buildAdminOtpEmail = (name: string, organizationName: string, otp: string) => {
    const safeName = name || "there";
    const safeOrganization = organizationName || "your project";

    const title = "Your APEXISpro™ Admin Access Code";
    const text = [
        `Hello ${safeName},`,
        "",
        "Welcome to APEXISpro™.",
        "Your construction communication platform.",
        "",
        `To access project "${safeOrganization}" on APEXISpro™ as an "Admin", your verification code is: ${otp}`,
        "",
        "This code is valid for 5 minutes.",
    ].join("\n");

    const html = `
        <div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <div style="padding:32px 32px 20px;border-bottom:1px solid #eef2f7;background:#ffffff;">
                    <div style="display:flex;align-items:center;gap:20px;">
                        <img src="cid:apexis-app-icon" alt="Apexis PRO logo" width="56" height="56" style="display:block;border-radius:14px;" />
                        <div style="margin-left:16px;">
                            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#0f172a;">${BRAND_NAME}<span style="font-size: 16px;">${BRAND_SUFFIX}</span></div>
                            <div style="font-size:14px;line-height:1.5;color:#475569;">${SLOGAN}</div>
                        </div>
                    </div>
                </div>
                <div style="padding:32px;">
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Hello ${safeName},</p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                        Welcome to <strong>${BRAND_NAME}<span style="font-size: 13px;">${BRAND_SUFFIX}</span></strong>.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        Your construction communication platform.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        To access project <strong>"${safeOrganization}"</strong> on ${BRAND_NAME}<span style="font-size: 13px;">${BRAND_SUFFIX}</span> as an <strong>"Admin"</strong>, your verification code is:
                    </p>
                    <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                        <div style="font-size:34px;line-height:1.2;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</div>
                    </div>
                    <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#64748b;">
                        This code is valid for 5 minutes.
                    </p>
                </div>
            </div>
        </div>
    `;

    return {
        subject: title,
        html,
        text,
        attachments: [
            {
                filename: "app-icon.png",
                path: appLogoPath,
                cid: "apexis-app-icon",
            },
        ],
    };
};

export const buildForgotPasswordOtpEmail = (name: string, otp: string) => {
    const safeName = name || "there";

    const title = "Your APEXISpro™ Password Reset Code";
    const text = [
        `Hello ${safeName},`,
        "",
        `Your verification code to reset your APEXISpro™ password is: ${otp}`,
        "",
        "This code is valid for 10 minutes.",
        "",
        "If you did not request this, please ignore this email or contact support.",
    ].join("\n");

    const html = `
        <div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <div style="padding:32px 32px 20px;border-bottom:1px solid #eef2f7;background:#ffffff;">
                    <div style="display:flex;align-items:center;gap:20px;">
                        <img src="cid:apexis-app-icon" alt="Apexis PRO logo" width="56" height="56" style="display:block;border-radius:14px;" />
                        <div style="margin-left:16px;">
                            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#0f172a;">${BRAND_NAME}<span style="font-size: 16px;">${BRAND_SUFFIX}</span></div>
                            <div style="font-size:14px;line-height:1.5;color:#475569;">${SLOGAN}</div>
                        </div>
                    </div>
                </div>
                <div style="padding:32px;">
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Hello ${safeName},</p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        We received a request to reset your password for your <strong>${BRAND_NAME}<span style="font-size: 13px;">${BRAND_SUFFIX}</span></strong> account.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        Your verification code is:
                    </p>
                    <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                        <div style="font-size:34px;line-height:1.2;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</div>
                    </div>
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#64748b;">
                        This code is valid for 10 minutes.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#94a3b8;">
                        If you did not request a password reset, please ignore this email or contact support.
                    </p>
                </div>
            </div>
        </div>
    `;

    return {
        subject: title,
        html,
        text,
        attachments: [
            {
                filename: "app-icon.png",
                path: appLogoPath,
                cid: "apexis-app-icon",
            },
        ],
    };
};

export const buildSuperadminOtpEmail = (name: string, otp: string) => {
    const safeName = name || "there";

    const title = "Your APEXISpro™ SuperAdmin Verification Code";
    const text = [
        `Hello ${safeName},`,
        "",
        "Welcome to the APEXISpro™ Administration Panel.",
        "",
        `Your verification code for SuperAdmin registration is: ${otp}`,
        "",
        "This code is valid for 5 minutes.",
    ].join("\n");

    const html = `
        <div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <div style="padding:32px 32px 20px;border-bottom:1px solid #eef2f7;background:#ffffff;">
                    <div style="display:flex;align-items:center;gap:20px;">
                        <img src="cid:apexis-app-icon" alt="Apexis PRO logo" width="56" height="56" style="display:block;border-radius:14px;" />
                        <div style="margin-left:16px;">
                            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#0f172a;">APEXIS<span style="font-size: 16px;">PRO™</span></div>
                            <div style="font-size:14px;line-height:1.5;color:#475569;">Record.Report.Release.</div>
                        </div>
                    </div>
                </div>
                <div style="padding:32px;">
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Hello ${safeName},</p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        Welcome to the <strong>APEXIS<span style="font-size: 13px;">PRO™</span></strong> Administration Panel.
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                        Your verification code for SuperAdmin registration is:
                    </p>
                    <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                        <div style="font-size:34px;line-height:1.2;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</div>
                    </div>
                    <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#64748b;">
                        This code is valid for 5 minutes.
                    </p>
                </div>
            </div>
        </div>
    `;

    return {
        subject: title,
        html,
        text,
        attachments: [
            {
                filename: "app-icon.png",
                path: appLogoPath,
                cid: "apexis-app-icon",
            },
        ],
    };
};

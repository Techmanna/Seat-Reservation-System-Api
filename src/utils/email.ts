import config from '../config/environment';
import nodemailer from "nodemailer";
import { logger } from "./logger";
 
// Looking to send emails in production? Check out our Email API/SMTP product!
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: {
    user: config.mail.senderEmail,
    pass: config.mail.password
  },
});

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  try {
    await transporter.sendMail({
      from: config.mail.from, // Valid format
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}`);
  } catch (err) {
    const errorInfo = {
      message: err instanceof Error ? err.message : "Unknown error",
      code: (err as any)?.code,
      command: (err as any)?.command,
      hostname: (err as any)?.hostname,
      syscall: (err as any)?.syscall,
    };
    logger.error("Email error:", errorInfo);
    if (errorInfo.code === "EDNS" && errorInfo.syscall === "getaddrinfo") {
      logger.error(
        `DNS resolution failed for ${errorInfo.hostname}. Verify SMTP hostname.`
      );
    }
    throw err;
  }
};

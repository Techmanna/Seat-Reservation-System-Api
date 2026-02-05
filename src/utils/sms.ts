import config from "../config/environment";
import AfricasTalking from "africastalking";
import { logger } from "./logger";

const africasTalking = AfricasTalking({
  apiKey: config.africastalking.piKey,
  username: config.africastalking.username,
});

export const sendSMS = async (phone: string | string[], message: string) => {
  try {
    logger.info("No config for SMS yet!");
    // const result = await africasTalking.SMS.send({
    //     to: Array.isArray(phone) ? phone : [phone],
    //     message,
    //     from: ''
    // });
    // logger.info('SMS sent:', result);
  } catch (err) {
    logger.error("SMS error:", err);
    // throw err;
  }
};

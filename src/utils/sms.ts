import config from "../config/environment";
import AfricasTalking from "africastalking";
import { logger } from "./logger";

const africasTalking = AfricasTalking({
  apiKey: config.africastalking.piKey,
  username: config.africastalking.username,
});

export const sendSMS = async (
  recipient: string | string[],
  message: string
) => {
  // Normalize recipient(s) to international format (Nigeria: +234)
  if (typeof recipient === "string") {
    if (recipient.length === 10 && !recipient.startsWith("0")) {
      recipient = "234" + recipient;
    } else if (recipient.startsWith("0")) {
      recipient = "234" + recipient.slice(1);
    }
  } else if (Array.isArray(recipient)) {
    recipient = recipient.map((r) => {
      if (r.length === 10 && !r.startsWith("0")) {
        return "234" + r;
      } else if (r.startsWith("0")) {
        return "234" + r.slice(1);
      }
      return r;
    });
  }

  try {
    console.log(config.sms);

    // const requestOptions = {
    //   method: "POST",
    //   body: JSON.stringify({
    //     api_key: config.sms.termii.apiKey,
    //     to: recipient,
    //     from: config.sms.termii.senderName,
    //     sms: message,
    //     type: "plain",
    //     channel: config.sms.termii.channel ?? "dnd",
    //   }),
    //   headers: {
    //     Accept: "application/json",
    //     "Content-Type": "application/json",
    //   },
    // };

    // const send = await fetch(
    //   config.sms.termii.baseUrl + "/api/sms/send",
    //   requestOptions
    // );

    // const data = await send.text();
    // console.log(send);

    // logger.info(`SMS sent ${recipient}`, data);
  } catch (err) {
    logger.error("SMS error:", err);
    // throw err;
  }
};

// sendSMS('08166551496', 'Test mail');
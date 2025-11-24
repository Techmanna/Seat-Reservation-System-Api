import config from '../config/environment';
import { Booking } from '../types/index';
import QRCode from 'qrcode';

export class QRService {
  private readonly qrUrl: string = `${config.adminUrl}/ticket-verification`;

  async generateQRCode(booking: Booking): Promise<string> {
    const qrData = `${this.qrUrl}/${booking.ticketId}`;
    const qrCodeString = await QRCode.toDataURL(qrData);
    return qrCodeString;
  }

  validateQRCode(qrData: string): boolean {
    try {
      return qrData.startsWith(this.qrUrl);
    } catch (error) {
      return false;
    }
  }
}

// export class QRService {
//   async generateQRCode(booking: Booking): Promise<string> {
//     const qrData = {
//       ticketId: booking.ticketId,
//       eventId: booking.event,
//       eventDate: booking.eventDate,
//       seatNumbers: booking.seatNumbers,
//       userId: booking.user
//     };

//     const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData));
//     return qrCodeString;
//   }

//   validateQRCode(qrData: string): boolean {
//     try {
//       const data = JSON.parse(qrData);
//       return !!(data.ticketId && data.eventId && data.eventDate && data.seatNumbers && data.userId);
//     } catch (error) {
//       return false;
//     }
//   }
// }
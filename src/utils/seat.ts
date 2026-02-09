import { SystemSettings } from "@/types";
import { startOfDay, endOfDay } from "date-fns";

export interface SeatInfo {
  number: number;
  label: string;
  isAvailable: boolean;
}

export class SeatUtils {
  /**
   * Generate seat labels based on total seats (A1, A2, ..., B1, B2, etc.)
   * Assumes 10 seats per row
   */
  static generateSeatLabel(seatNumber: number): string {
    const seatsPerRow = 10;
    const rowIndex = Math.floor((seatNumber - 1) / seatsPerRow);
    const seatInRow = ((seatNumber - 1) % seatsPerRow) + 1;
    const rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C, etc.

    return `${rowLetter}${seatInRow}`;
  }

  /**
   * Convert seat label back to seat number
   */
  static seatLabelToNumber(seatLabel: string): number {
    const match = seatLabel.match(/^([A-Z])(\d+)$/);
    if (!match) {
      throw new Error(`Invalid seat label: ${seatLabel}`);
    }

    const [, rowLetter, seatInRowStr] = match;
    const seatsPerRow = 10;
    const rowIndex = rowLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, etc.
    const seatInRow = parseInt(seatInRowStr, 10);

    return rowIndex * seatsPerRow + seatInRow;
  }

  /**
   * Generate all seat information for a given total seats count
   */
  static generateAllSeats(
    totalSeats: number,
    bookedSeatNumbers: number[] = []
  ): SeatInfo[] {
    const seats: SeatInfo[] = [];

    for (let i = 1; i <= totalSeats; i++) {
      seats.push({
        number: i,
        label: this.generateSeatLabel(i),
        isAvailable: !bookedSeatNumbers.includes(i),
      });
    }

    return seats;
  }

  /**
   * Get available seats only
   */
  static getAvailableSeats(
    totalSeats: number,
    bookedSeatNumbers: number[] = []
  ): SeatInfo[] {
    return this.generateAllSeats(totalSeats, bookedSeatNumbers).filter(
      (seat) => seat.isAvailable
    );
  }

  /**
   * Validate seat labels and convert to numbers
   */
  static validateAndConvertSeatLabels(
    seatLabels: string[],
    totalSeats: number
  ): { numbers: number[]; labels: string[] } {
    const numbers: number[] = [];
    const labels: string[] = [];

    for (const label of seatLabels) {
      try {
        const number = this.seatLabelToNumber(label);

        if (number < 1 || number > totalSeats) {
          throw new Error(`Seat ${label} is out of range (1-${totalSeats})`);
        }

        numbers.push(number);
        labels.push(label);
      } catch (error) {
        throw new Error(`Invalid seat label: ${label}`);
      }
    }

    return { numbers, labels };
  }

  static resolveTotalSeats(settings: SystemSettings, eventDate: Date): number {
    const override = settings.seatCapacityOverrides?.find(
      (o) => o.date >= startOfDay(eventDate) && o.date <= endOfDay(eventDate)
    );

    return override?.totalSeats || settings.defaultTotalSeats;
  }
}

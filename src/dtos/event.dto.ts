import { Event } from "../types";

export class EventDTO {
    static toResponse(event: Event | null) {
        return {
            id: event?._id?.toString(),
            date: event?.date,
            time: event?.time,
            totalSeats: event?.totalSeats,
            availableSeats: event?.availableSeats,
            isActive: event?.isActive,
            zoomMeetingId: event?.zoomMeetingId,
            zoomMeetingUrl: event?.zoomMeetingUrl,
            zoomPassword: event?.zoomPassword,
            title: event?.title,
            createdAt: event?.createdAt,
            updatedAt: event?.updatedAt
        };
    }
}
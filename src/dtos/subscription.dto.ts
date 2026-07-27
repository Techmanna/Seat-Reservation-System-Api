import { ISubscription } from "@/types/subscription.type";

export class SubscriptionDTO {
    static toResponse(subscription: ISubscription) {
        return {
            userId: subscription.userId,
            email: subscription.email,
            tier: subscription.tier,
            provider: subscription.provider,
            status: subscription.status,
            providerSubscriptionId: subscription.providerSubscriptionId,
            providerCustomerId: subscription.providerCustomerId,
            currentPeriodEnd: subscription.currentPeriodEnd,
            zoomRegistrantId: subscription.zoomRegistrantId,
            lastZoomMeetingId: subscription.lastZoomMeetingId,
            timezone: subscription.timezone,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt
        };
    }
}
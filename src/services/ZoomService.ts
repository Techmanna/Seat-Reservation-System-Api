import dotenv from 'dotenv';

dotenv.config();

interface ZoomRegistrantResponse {
    id: string;
    join_url: string;
    registrant_id: string;
}

export class ZoomService {
    private static accountId = process.env.ZOOM_ACCOUNT_ID || '';
    private static clientId = process.env.ZOOM_CLIENT_ID || '';
    private static clientSecret = process.env.ZOOM_CLIENT_SECRET || '';

    private static async getAccessToken(): Promise<string> {
        if (!this.accountId || !this.clientId || !this.clientSecret) {
            console.warn("[ZoomService] Missing credentials. Returning mock token.");
            return "mock_zoom_token";
        }

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const data = await response.json() as any;
            if (!response.ok) {
                throw new Error(data.reason || 'Failed to fetch Zoom Access Token');
            }
            return data.access_token;
        } catch (error: any) {
            console.error("[ZoomService] Token acquisition failed:", error.message);
            throw error;
        }
    }

    public static async registerSubscriber(
        webinarId: string,
        email: string,
        firstName: string,
        lastName: string
    ): Promise<ZoomRegistrantResponse> {
        if (!this.clientId) {
            console.log(`[ZoomService] Mock registration for ${email} to webinar ${webinarId}`);
            return {
                id: 'mock_reg_id',
                join_url: `https://zoom.us/j/mock_${webinarId}?token=${Date.now()}`,
                registrant_id: 'mock_registrant_123'
            };
        }

        const token = await this.getAccessToken();
        const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/registrants`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                first_name: firstName,
                last_name: lastName
            })
        });

        const data = await response.json() as any;
        if (!response.ok) {
            throw new Error(data.message || 'Failed to register webinar attendee');
        }

        return {
            id: data.id,
            join_url: data.join_url,
            registrant_id: data.registrant_id || data.id
        };
    }

    public static async removeSubscriber(webinarId: string, registrantId: string): Promise<boolean> {
        if (!this.clientId) {
            console.log(`[ZoomService] Mock removal of registrant ${registrantId}`);
            return true;
        }

        const token = await this.getAccessToken();
        const response = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/registrants/${registrantId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 204 || response.ok) {
            return true;
        }
        return false;
    }

    public static async createMeeting(topic: string, startTime: Date, timezone?: string): Promise<{ id: string, join_url: string, password?: string }> {
        if (!this.clientId) {
            const mockId = `mock_mtg_${Math.floor(Math.random() * 1000000)}`;
            console.log(`[ZoomService] Mock meeting creation for ${topic}`);
            return {
                id: mockId,
                join_url: `https://zoom.us/j/${mockId}`,
                password: 'mock_password'
            };
        }

        const token = await this.getAccessToken();

        // Ensure start_time is in the format Zoom likes: YYYY-MM-DDTHH:mm:ssZ
        const formattedStartTime = startTime.toISOString().split('.')[0] + 'Z';

        const response = await fetch(`https://api.zoom.us/v2/users/me/meetings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic,
                type: 2, // Scheduled meeting
                start_time: formattedStartTime,
                timezone: timezone || 'UTC',
                duration: 120,
                settings: {
                    approval_type: 0,
                    registration_type: 1,
                    waiting_room: false,        // Disable — registration token is the gate
                    join_before_host: false,
                    mute_upon_entry: true,
                    participant_video: false,
                    host_video: true,
                    registrants_email_notification: false, // You handle emails yourself
                    enforce_login: false,
                    // KEY: require registrants to use their unique join URL
                    registrants_confirmation_email: false,
                }
            })
        });

        const data = await response.json() as any;
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create Zoom Meeting');
        }

        return {
            id: data.id.toString(),
            join_url: data.join_url,
            password: data.password
        };
    }

    public static async registerMeetingAttendee(
        meetingId: string,
        email: string,
        firstName: string,
        lastName: string
    ): Promise<{ registrant_id: string, join_url: string }> {
        if (!this.clientId) {
            return {
                registrant_id: `mock_registrant_${Date.now()}`,
                join_url: `https://zoom.us/j/${meetingId}/join?token=mock_${Date.now()}`
            };
        }

        const token = await this.getAccessToken();
        const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                first_name: firstName,
                last_name: lastName ?? ''
            })
        });

        const data = await response.json() as any;
        if (!response.ok) {
            throw new Error(data.message || 'Failed to register meeting attendee');
        }

        return {
            registrant_id: data.registrant_id || data.id.toString(),
            join_url: data.join_url
        };
    }

    public static async removeMeetingAttendee(meetingId: string, registrantId: string): Promise<boolean> {
        if (!this.clientId) {
            return true;
        }

        const token = await this.getAccessToken();
        const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants/${registrantId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 204 || response.ok) {
            return true;
        }
        return false;
    }
}

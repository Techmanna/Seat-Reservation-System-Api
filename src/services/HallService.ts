import { NotFoundError } from "../middleware/errorHandler";
import { HallModel } from "../models/Hall";
import { SystemSettingsModel } from "../models/SystemSettings";
import { ApiResponse, Hall } from "../types";

export class HallService {
    /**
     * Get the default hall (e.g., Lagos Hall) or the first available one.
     * Used for backward compatibility with existing booking flows.
     */
    static async getDefaultHall(): Promise<Hall> {
        // Find by specific name first, then fallback to first active
        let hall = await HallModel.findOne({ name: "Lagos Hall" });
        if (!hall) {
            hall = await HallModel.findOne({ isActive: true });
        }
        if (!hall) {
            // As a last resort fallback, find any hall
            hall = await HallModel.findOne();
        }
        if (!hall) {
            // Auto-migrate from SystemSettings if no halls exist
            const legacySettings = await SystemSettingsModel.findOne();
            if (legacySettings) {
                const legacyData: any = legacySettings.toObject();
                delete legacyData._id;
                delete legacyData.__v;
                delete legacyData.createdAt;
                delete legacyData.updatedAt;

                hall = new HallModel({
                    ...legacyData,
                    name: "Lagos Hall",
                    state: "Lagos",
                    city: "Ikeja",
                    address: "Default Lagos Address",
                    isActive: true,
                });
                await hall.save();
            } else {
                throw new NotFoundError('No halls configured in the system');
            }
        }
        return hall;
    }

    async getHalls(activeOnly: boolean = false, publicOnly: boolean = false): Promise<ApiResponse<Hall[]>> {
        const query: any = activeOnly ? { isActive: true } : {};
        if (publicOnly) {
            const now = new Date();
            // query.reservationOpenDate = { $lte: now };
            query.reservationCloseDate = { $gte: now };
        }
        const halls = await HallModel.find(query).sort({ reservationOpenDate: 1 });
        
        return {
            success: true,
            message: 'Halls retrieved successfully',
            data: halls
        };
    }

    async getHallById(hallId: string): Promise<ApiResponse<Hall>> {
        const hall = await HallModel.findById(hallId);
        
        if (!hall) {
            throw new NotFoundError('Hall not found');
        }

        return {
            success: true,
            message: 'Hall retrieved successfully',
            data: hall
        };
    }

    async createHall(hallData: Partial<Hall>): Promise<ApiResponse<Hall>> {
        const hall = new HallModel(hallData);
        await hall.save();

        return {
            success: true,
            message: 'Hall created successfully',
            data: hall
        };
    }

    async updateHall(hallId: string, hallData: Partial<Hall>): Promise<ApiResponse<Hall>> {
        const hall = await HallModel.findByIdAndUpdate(hallId, hallData, { new: true });
        
        if (!hall) {
            throw new NotFoundError('Hall not found');
        }

        return {
            success: true,
            message: 'Hall updated successfully',
            data: hall
        };
    }

    async toggleHallStatus(hallId: string, isActive: boolean): Promise<ApiResponse<Hall>> {
        const hall = await HallModel.findByIdAndUpdate(hallId, { isActive }, { new: true });
        
        if (!hall) {
            throw new NotFoundError('Hall not found');
        }

        return {
            success: true,
            message: `Hall ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: hall
        };
    }
}

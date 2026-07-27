import { NotFoundError } from "../middleware/errorHandler";
import { HallModel } from "../models/Hall";
import { ApiResponse, Hall } from "../types";
import { HallService } from "./HallService";


export async function getSystemSettings(): Promise<Hall> {
    const settings = await HallService.getDefaultHall();

    if (!settings) {
        throw new NotFoundError('System settings not configured');
    }

    return settings;
}

export class SettingsService {
    async getSettings(): Promise<ApiResponse<Hall>> {
        const settings = await getSystemSettings();
        return {
            success: true,
            message: 'Settings retrieved successfully',
            data: settings
        };
    }

    async updateSettings(settings: Partial<Hall>): Promise<ApiResponse<Hall>> {
        const defaultHall = await getSystemSettings();
        const updatedSettings = await HallModel.findByIdAndUpdate(defaultHall._id, settings, { new: true });

        if (!updatedSettings) {
            throw new NotFoundError('Settings not found');
        }

        return {
            success: true,
            message: 'Settings updated successfully',
            data: updatedSettings
        };
    }
}
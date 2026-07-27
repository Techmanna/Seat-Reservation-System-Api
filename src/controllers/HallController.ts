import { Request, Response } from "express";
import { HallService } from "../services/HallService";
import { Hall } from "../types";

export class HallController {
  private hallService: HallService;

  constructor() {
    this.hallService = new HallService();
  }

  // Create a new hall
  public createHall = async (req: Request, res: Response) => {
    try {
      const result = await this.hallService.createHall(req.body as Partial<Hall>);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create hall",
      });
    }
  };

  // Get all halls
  public getHalls = async (req: Request, res: Response) => {
    try {
      const publicOnly = req.query.public === 'true';
      const result = await this.hallService.getHalls(false, publicOnly);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to retrieve halls",
      });
    }
  };

  // Get a hall by ID
  public getHallById = async (req: Request, res: Response) => {
    try {
      const result = await this.hallService.getHallById(req.params.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "Hall not found",
      });
    }
  };

  // Update a hall
  public updateHall = async (req: Request, res: Response) => {
    try {
      const result = await this.hallService.updateHall(req.params.id, req.body as Partial<Hall>);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update hall",
      });
    }
  };



  // Get default hall
  public getDefaultHall = async (req: Request, res: Response) => {
    try {
      const hall = await HallService.getDefaultHall();
      res.status(200).json({
        success: true,
        message: "Default hall retrieved successfully",
        data: hall,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "Default hall not found",
      });
    }
  };
}

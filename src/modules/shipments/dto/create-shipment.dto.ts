import { IsMongoId, IsObject } from 'class-validator';

export class CreateShipmentDto {
  @IsMongoId()
  orderId: string;

  @IsMongoId()
  carrierId: string; // 3PL orgId

  @IsObject()
  vehicle: {
    vehicleNumber: string;
    vehicleType: string;
    driverName: string;
    driverMobile: string;
  };

  @IsObject()
  pickup: {
    location: string;
    pin: string;
    scheduledAt?: string;
  };

  @IsObject()
  delivery: {
    location: string;
    pin: string;
    city: string;
    state: string;
    scheduledAt?: string;
    eta?: string;
  };
}

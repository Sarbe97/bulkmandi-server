import { IsMongoId, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class VehicleDto {
  @IsString()
  vehicleNumber: string;

  @IsString()
  vehicleType: string;

  @IsString()
  driverName: string;

  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Driver mobile must be exactly 10 digits' })
  driverMobile: string;
}

class PickupDto {
  @IsString()
  location: string;

  @IsString()
  pin: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

class DeliveryDto {
  @IsString()
  location: string;

  @IsString()
  pin: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  eta?: string;
}

export class CreateShipmentDto {
  @IsMongoId()
  orderId: string;

  @IsOptional()
  @IsMongoId()
  carrierId?: string; // 3PL orgId — omit for buyer self-pickup

  @IsOptional()
  @IsString()
  logisticsMode?: 'PLATFORM_3PL' | 'SELF_PICKUP' | 'SELLER_MANAGED';

  @IsObject()
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle: VehicleDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PickupDto)
  pickup: PickupDto;

  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery: DeliveryDto;
}

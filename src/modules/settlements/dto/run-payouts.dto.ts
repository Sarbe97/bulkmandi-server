import { IsString } from 'class-validator';

export class RunPayoutsDto {
  @IsString()
  batchId: string;
}

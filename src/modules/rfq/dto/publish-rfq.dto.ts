import { IsBoolean, IsOptional } from 'class-validator';

export class PublishRfqDto {
  @IsBoolean()
  @IsOptional()
  autoMatch?: boolean;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RejectPaymentDto {
    @ApiProperty({ example: "Incorrect UTR provided", description: "Reason for rejection" })
    @IsString()
    @IsNotEmpty()
    reason: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { AccountType } from "src/generated/prisma/client";

export class AccountResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() userId: string;
    @ApiProperty() name: string;
    @ApiProperty({ enum: AccountType }) type: AccountType;
    @ApiProperty() openingBalance: number;
    @ApiProperty() isArchived: boolean;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}
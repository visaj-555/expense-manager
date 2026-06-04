import { ApiProperty } from '@nestjs/swagger';
import { Role } from 'src/generated/prisma/enums';

export class VerifyTokenUserDto {
  @ApiProperty({ example: '019b3b95-9c4d-70ac-a228-903e54f13c95' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;
}

export class VerifyTokenDataDto {
  @ApiProperty({ type: VerifyTokenUserDto })
  user: VerifyTokenUserDto;
}

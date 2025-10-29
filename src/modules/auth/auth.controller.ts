import { Body, Controller, Post } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { AuthResponseDto, LoginDto, RegisterDto } from "./dto/auth.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    // ensure id fields are strings to satisfy AuthResponseDto
    const user = {
      ...result.user,
      id: String(result.user.id),
      organizationId: String(result.user.organizationId),
    };
    return { ...result, user };
  }
 
  @Post("login")
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }
}

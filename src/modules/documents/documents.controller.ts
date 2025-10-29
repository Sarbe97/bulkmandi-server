import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN, UserRole['3PL'])
  @Post(':entityId/upload')
  async uploadDocument(
    @Param('entityId') entityId: string,
    @Body() uploadDocumentDto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(entityId, uploadDocumentDto);
  }
}

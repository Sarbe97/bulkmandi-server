import { PartialType } from '@nestjs/swagger';
import { CreateMasterDatumDto } from './create-master-data.dto';

export class UpdateMasterDatumDto extends PartialType(CreateMasterDatumDto) { }

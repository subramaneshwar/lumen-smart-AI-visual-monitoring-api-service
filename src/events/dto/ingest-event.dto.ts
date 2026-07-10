import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class IngestEventDto {
  @IsUUID()
  camera_id: string;

  @IsString()
  event_type: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsOptional()
  @IsString()
  clip_path?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  face_embedding?: number[];
}

import { IsString } from 'class-validator';

export class AttachClipDto {
  @IsString()
  event_ids: string;
}

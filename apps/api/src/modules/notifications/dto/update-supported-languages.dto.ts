import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SupportedLanguageInputDto {
  @IsString()
  @MaxLength(10)
  code!: string;

  @IsString()
  @MaxLength(80)
  label!: string;
}

export class UpdateSupportedLanguagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupportedLanguageInputDto)
  items!: SupportedLanguageInputDto[];
}

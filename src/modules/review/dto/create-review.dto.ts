import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

/**
 * DTO for manually triggering a review
 */
export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  repository: string;

  @IsNumber()
  @IsNotEmpty()
  prNumber: number;

  @IsString()
  @IsOptional()
  mode?: 'comment' | 'fix';
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { SummariesService } from './summaries.service';
import { ListSummariesQueryDto } from './dto/list-summaries-query.dto';
import { GenerateSummaryDto } from './dto/generate-summary.dto';

@Controller('summaries')
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Get()
  async findAll(@Query() query: ListSummariesQueryDto) {
    return await this.summariesService.findByPeriodAndDate(
      query.period,
      query.date,
    );
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() dto: GenerateSummaryDto) {
    return await this.summariesService.generateDailySummary(dto.date);
  }
}
